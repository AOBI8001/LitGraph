import {chunkDocument,CHUNK_VERSION,fingerprint} from '../src/research-evidence.js';
import {EMBEDDING_REVISION} from '../src/research-embedding.js';

// Indexing is a background ingestion task. Search never embeds missing passages.
export function createRagIndex({embed,readRecord,readIndex,writeIndex,yieldWork=()=>new Promise(r=>setTimeout(r,25))}) {
 const jobs=new Map(),ready=new Map();let draining=false,paused=false,closed=false,foreground=0;
 const version=CHUNK_VERSION+':'+EMBEDDING_REVISION;
 const remember=(key,index)=>{ready.delete(key);ready.set(key,index);if(ready.size>64)ready.delete(ready.keys().next().value);};
 async function drain(){
  if(draining||paused||closed)return;draining=true;
  try{while(!paused&&!closed){
   const job=[...jobs.values()].find(j=>j.state==='queued');if(!job)break;
   job.state='indexing';
   try{
    const record=await readRecord(job.key);if(!record?.markdown){job.state='no_source';continue;}
    const hash=fingerprint(record.markdown.replace(/\r\n/g,'\n'));
    let index=ready.get(job.key)||await readIndex(job.key).catch(()=>null);
    if(index?.version!==version||index.hash!==hash||index.nodeId!==job.node.id)index=null;
    const chunks=chunkDocument(record,job.node);job.total=chunks.length;
    const entries=index?.entries||[];job.completed=entries.length;
    for(let i=entries.length;i<chunks.length;i+=8){
     while((paused||foreground)&&!closed)await yieldWork();if(closed)return;
     const batch=chunks.slice(i,i+8),vectors=await embed(batch.map(c=>`${c.heading||''}\n${c.text}`),'passage');
     entries.push(...batch.map((c,k)=>({chunkId:c.chunkId,vector:vectors[k]})));job.completed=entries.length;
     index={version,hash,nodeId:job.node.id,entries};remember(job.key,index);
     // Checkpoints plus content-addressed vector cache make restarts incremental.
     if(entries.length%128===0||entries.length===chunks.length)await writeIndex(job.key,index);
     await yieldWork();
    }
    index={version,hash,nodeId:job.node.id,entries};await writeIndex(job.key,index);remember(job.key,index);job.state='ready';
   }catch(error){job.state='failed';job.error=String(error.message).slice(0,200);}
   if(job.rerun){job.rerun=false;job.state='queued';}
  }}finally{draining=false;}
 }
 return {
  enqueue(key,node,{changed=false}={}){if(closed)return;const existing=jobs.get(key);if(existing&&!changed&&existing.node.id===node.id)return;
   if(existing?.state==='indexing'){existing.rerun ||= changed||existing.node.id!==node.id;existing.node={...node};return;}
   jobs.set(key,{key,node:{id:node.id,title:node.title,authors:node.authors,year:node.year,doi:node.doi},state:'queued',completed:0,total:0});void drain();},
  status(keys){const list=(keys||[...jobs.keys()]).map(key=>jobs.get(key)).filter(Boolean);return {paused,documents:list.length,ready:list.filter(j=>j.state==='ready').length,failed:list.filter(j=>j.state==='failed').length,queued:list.filter(j=>j.state==='queued').length,indexing:list.filter(j=>j.state==='indexing').length,chunks:list.reduce((n,j)=>n+j.total,0),completedChunks:list.reduce((n,j)=>n+j.completed,0),states:list.map(j=>({key:j.key,state:j.state,completed:j.completed,total:j.total,error:j.error}))};},
  control(action){if(action==='pause')paused=true;else{paused=false;if(action==='retry')for(const job of jobs.values())if(job.state==='failed'||job.state==='no_source')job.state='queued';void drain();}return {paused};},
  async search(documents,queries,signal){foreground++;try{
   signal?.throwIfAborted();const ranks=queries.map(()=>[]),available=[];let indexedChunks=0,missingDocuments=0;
   for(const doc of documents){signal?.throwIfAborted();const index=ready.get(doc.key)||await readIndex(doc.key).catch(()=>null);
    if(!index||index.version!==version||index.hash!==doc.hash||index.nodeId!==doc.id){missingDocuments++;continue;}
    remember(doc.key,index);indexedChunks+=index.entries.length;available.push(index);
   }
   // A cold/empty scope needs no model load or query embedding at all.
   if(!indexedChunks)return {ranks,indexedChunks,missingDocuments};
   const qvectors=await embed(queries,'query',signal);
   for(const index of available)for(const entry of index.entries)for(let q=0;q<qvectors.length;q++){const score=entry.vector.reduce((s,x,i)=>s+x*qvectors[q][i],0);ranks[q].push({chunkId:entry.chunkId,score});}
   return {ranks:ranks.map(r=>r.sort((a,b)=>b.score-a.score).slice(0,80)),indexedChunks,missingDocuments};
  }finally{foreground--; }},
  close(){closed=true;},
 };
}
