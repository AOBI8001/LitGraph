import {parentPort,workerData} from 'node:worker_threads';
import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {pipeline,env} from '@huggingface/transformers';
import {createEmbedder,EMBEDDING_MODEL,EMBEDDING_REVISION} from '../src/research-embedding.js';
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
parentPort.on('message',async message=>{
 if(message.cancel){controllers.get(message.cancel)?.abort();return;}
 const controller=new AbortController();controllers.set(message.id,controller);
 try{const vectors=await embed(message.texts,message.kind,controller.signal);parentPort.postMessage({id:message.id,vectors});}
 catch(error){parentPort.postMessage({id:message.id,error:error.message});}
 finally{controllers.delete(message.id);}
});
