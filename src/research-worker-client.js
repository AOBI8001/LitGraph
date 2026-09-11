let worker;const pending=new Map();
export function retrieveInWorker(documents,question,plan,options={}){
 worker ||= new Worker(new URL('./research-worker.js',import.meta.url),{type:'module'});
 worker.onmessage=({data})=>{const task=pending.get(data.id);if(!task)return;pending.delete(data.id);task.cleanup();data.error?task.reject(Error(data.error)):task.resolve(data.result);};
 worker.onerror=()=>{for(const task of pending.values()){task.cleanup();task.reject(Error('Local retrieval worker failed. / 本地检索进程失败。'));}pending.clear();worker.terminate();worker=null;};
 return new Promise((resolve,reject)=>{const id=crypto.randomUUID(),{signal,...plain}=options;signal?.throwIfAborted();const abort=()=>{worker?.postMessage({cancel:id});pending.delete(id);reject(signal.reason||new DOMException('Aborted','AbortError'));};pending.set(id,{resolve,reject,cleanup:()=>signal?.removeEventListener('abort',abort)});signal?.addEventListener('abort',abort,{once:true});worker.postMessage({id,documents,question,plan,options:plain});});
}
