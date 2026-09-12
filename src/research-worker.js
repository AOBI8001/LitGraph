import {hybridEvidence} from './research-hybrid.js';
import {localRequest} from './external-agent.js';
// Rank off the UI thread; native CPU embeddings use the authenticated local service.
const searchIndex=(documents,queries,signal)=>localRequest('vector-index',{operation:'search',documents,queries},{signal});
const controllers=new Map();
self.onmessage=async({data})=>{if(data.cancel){controllers.get(data.cancel)?.abort();return;}const controller=new AbortController();controllers.set(data.id,controller);try{const result=await hybridEvidence(data.documents,data.question,data.plan,{...data.options,searchIndex,signal:controller.signal});self.postMessage({id:data.id,result});}catch(error){self.postMessage({id:data.id,error:error.message});}finally{controllers.delete(data.id);}};
