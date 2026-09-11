import {Worker} from 'node:worker_threads';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

// One serialized CPU worker per local service, separate from Electron's UI thread.
export function createVectorService(root,dataRoot){
 let worker;const pending=new Map();
 function start(){
  if(worker)return worker;
  const normalizedRoot=path.resolve(root);
  const diskRoot=normalizedRoot.endsWith('.asar')?normalizedRoot+'.unpacked':normalizedRoot;
  const models=[path.join(diskRoot,'dist','models'),path.join(root,'public','models')].find(p=>existsSync(path.join(p,'manifest.json')));
  if(!models)throw Error('Local embedding model is missing. / 缺少本地向量模型文件。');
  const sampleVectors=[path.join(root,'dist','sample-fulltext','vectors.e5.q8.json.gz'),path.join(root,'public','sample-fulltext','vectors.e5.q8.json.gz')].find(existsSync)||'';
  const active=new Worker(new URL('./rag-vector-worker.mjs',import.meta.url),{workerData:{models,sampleVectors,cache:path.join(dataRoot,'data','vectors','rag')}});worker=active;active.unref();
  const fail=error=>{if(worker===active)worker=null;for(const [id,task]of pending){task.cleanup();task.reject(error);pending.delete(id);}};
  active.on('message',message=>{const task=pending.get(message.id);if(!task)return;pending.delete(message.id);task.cleanup();message.error?task.reject(Error(message.error)):task.resolve(message.vectors);if(!pending.size)active.unref();});
  active.on('error',fail);active.on('exit',code=>{if(worker===active){worker=null;if(pending.size)fail(Error('Local vector worker exited: '+code));}});
  return active;
 }
 return async(texts,kind,signal)=>{
  if(!Array.isArray(texts)||texts.length>128||!texts.every(t=>typeof t==='string'&&t.length<=4000)||!['query','passage'].includes(kind))throw Error('Invalid embedding request');
  signal?.throwIfAborted();const active=start();active.ref();
  return new Promise((resolve,reject)=>{const id=randomUUID(),cleanup=()=>signal?.removeEventListener('abort',abort),abort=()=>{pending.delete(id);active.postMessage({cancel:id});cleanup();if(!pending.size)active.unref();reject(signal.reason||Error('Cancelled'));};pending.set(id,{resolve,reject,cleanup});signal?.addEventListener('abort',abort,{once:true});active.postMessage({id,texts,kind});});
 };
}
