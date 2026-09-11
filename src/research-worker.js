import {hybridEvidence} from './research-hybrid.js';
import {localRequest} from './external-agent.js';
// Rank off the UI thread; native CPU embeddings use the authenticated local service.
const embed=async(texts,kind,signal)=>{const vectors=[];for(let i=0;i<texts.length;i+=128){signal?.throwIfAborted();const batch=await localRequest('embeddings',{texts:texts.slice(i,i+128),kind},{signal});vectors.push(...batch.vectors);}return vectors;};
const controllers=new Map();
self.onmessage=async({data})=>{if(data.cancel){controllers.get(data.cancel)?.abort();return;}const controller=new AbortController();controllers.set(data.id,controller);try{const result=await hybridEvidence(data.documents,data.question,data.plan,{...data.options,embed,signal:controller.signal});self.postMessage({id:data.id,result});}catch(error){self.postMessage({id:data.id,error:error.message});}finally{controllers.delete(data.id);}};
