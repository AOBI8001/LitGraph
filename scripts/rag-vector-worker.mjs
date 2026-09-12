import {parentPort,workerData} from 'node:worker_threads';
import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {pipeline,env} from '@huggingface/transformers';
import {createEmbedder,EMBEDDING_MODEL,EMBEDDING_REVISION} from '../src/research-embedding.js';
import {createRagIndex} from './rag-index.mjs';
import {createHash} from 'node:crypto';
import {loadSampleDocument} from '../src/sample-corpus.js';
env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath=workerData.models+'/';
await fs.mkdir(workerData.cache,{recursive:true});
const file=key=>path.join(workerData.cache,key.replaceAll(':','_')+'.json');
let bundled;
async function sampleVector(key){
 bundled ||= fs.readFile(workerData.sampleVectors).then(bytes=>{
  const index=JSON.parse(gunzipSync(bytes));
  if(index.version!==1||index.revision!==EMBEDDING_REVISION||index.model!==EMBEDDING_MODEL||index.dimension!==384)throw Error('Incompatible sample vectors');
  return new Map(index.records.map(([key,input,encoded])=>[key,{input,encoded}]));
 }).catch(()=>new Map());
 const record=(await bundled).get(key);if(!record)return null;
 const bytes=Buffer.from(record.encoded,'base64');if(bytes.length!==384*4)return null;
 return {input:record.input,vector:Array.from({length:384},(_,i)=>bytes.readFloatLE(i*4))};
}
const embed=createEmbedder({
 load:()=>pipeline('feature-extraction',EMBEDDING_MODEL,{dtype:'q8',device:'cpu',session_options:{intraOpNumThreads:2}}),
 read:async key=>await sampleVector(key)||fs.readFile(file(key),'utf8').then(JSON.parse).catch(()=>null),
 write:async(key,value)=>{const destination=file(key),temporary=destination+'.tmp';await fs.writeFile(temporary,JSON.stringify(value));await fs.rename(temporary,destination);}
});
const controllers=new Map();
const indexRoot=path.join(workerData.cache,'documents');
await fs.mkdir(indexRoot,{recursive:true});
const validKey=key=>{if(!/^[a-f0-9]{64}$/.test(key||''))throw Error('Invalid document key');return key;};
const sampleRecords=new Map();
const index=createRagIndex({embed,
 readRecord:key=>fs.readFile(path.join(workerData.dataRoot,'data','records',validKey(key)+'.json'),'utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT'&&sampleRecords.has(key))return sampleRecords.get(key);throw error;}),
 readIndex:key=>fs.readFile(path.join(indexRoot,validKey(key)+'.json'),'utf8').then(JSON.parse),
 writeIndex:async(key,value)=>{const file=path.join(indexRoot,validKey(key)+'.json');await fs.writeFile(file+'.tmp',JSON.stringify(value));await fs.rename(file+'.tmp',file);}
});
const controlFile=path.join(indexRoot,'control.json');
// Index maintenance is automatic. A legacy UI pause must not disable indexing
// forever after upgrading/restarting; completed checkpoints are still reused.
await fs.writeFile(controlFile,JSON.stringify({paused:false}));
parentPort.on('message',async message=>{
 if(message.cancel){controllers.get(message.cancel)?.abort();return;}
 const controller=new AbortController();controllers.set(message.id,controller);
 try{let vectors;
  if(message.operation==='enqueue'){for(const doc of message.documents)index.enqueue(validKey(doc.key),doc.node,{changed:message.changed});vectors={queued:true};}
  else if(message.operation==='status')vectors=index.status(message.keys);
  else if(message.operation==='control'){vectors=index.control(message.action);await fs.writeFile(controlFile,JSON.stringify(vectors));}
  else if(message.operation==='search')vectors=await index.search(message.documents,message.queries,controller.signal);
  else vectors=await embed(message.texts,message.kind,controller.signal);
  parentPort.postMessage({id:message.id,vectors});}
 catch(error){parentPort.postMessage({id:message.id,error:error.message});}
 finally{controllers.delete(message.id);}
});
// Resume existing projects on launch; hidden/unanalysed imports are not brought
// back onto the canvas. Their source files are never changed by indexing.
// Sample originals already ship with the application. Register their current
// chunks on launch instead of waiting for the first question to discover them.
if(workerData.sampleDirectory){
 const read=file=>fs.readFile(path.join(workerData.sampleDirectory,file),'utf8');
 try{const catalog=JSON.parse(await read('index.json'));
  for(const entry of catalog.documents||[]){const node={...entry,isSample:true};
   try{const document=await loadSampleDocument(node,read);if(!document)continue;
    const key=createHash('sha256').update(`sample-md:${node.id}:${document.corpusHash}`).digest('hex');
    sampleRecords.set(key,document);index.enqueue(key,node);
   }catch(error){console.warn('Bundled sample index:',entry.id,String(error.message).slice(0,120));}
  }
 }catch(error){console.warn('Bundled sample catalogue:',String(error.message).slice(0,120));}
}
for(const file of await fs.readdir(path.join(workerData.dataRoot,'data','projects')).catch(()=>[])){
 if(!/^[a-f0-9]{64}\.json$/.test(file))continue;
 try{const project=JSON.parse(await fs.readFile(path.join(workerData.dataRoot,'data','projects',file),'utf8'));
  for(const node of project.nodes||[])if(!node.importCanvasHidden&&node.fulltextKey)index.enqueue(validKey(node.fulltextKey),node);
 }catch{}
}
