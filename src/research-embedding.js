// Same local, quantized multilingual model for API and external-Agent research.
import {fingerprint} from './research-evidence.js';
export const EMBEDDING_MODEL='Xenova/multilingual-e5-small';
export const EMBEDDING_REVISION='761b726dd34fb83930e26aab4e9ac3899aa1fa78';
export function createEmbedder({load,read=async()=>null,write=async()=>{},batchSize=8}={}){
 let extractor,queue=Promise.resolve();const memory=new Map();
 return (texts,kind='passage',signal)=>{
  const task=queue.then(async()=>{
   signal?.throwIfAborted();const results=Array(texts.length),missing=[],dedup=new Map();
   for(let i=0;i<texts.length;i++){const input=`${kind}: ${texts[i]}`,key=EMBEDDING_REVISION+':mean:q8:'+fingerprint(input);if(dedup.has(input)){dedup.get(input).indices.push(i);continue;}let cached=memory.get(key)||await read(key);if(cached?.input===input&&cached.vector?.length===384&&cached.vector.every(Number.isFinite)){results[i]=cached.vector;memory.set(key,cached);}else {const item={indices:[i],key,input};missing.push(item);dedup.set(input,item);}}
   if(missing.length)extractor ||= await load();
   for(let i=0;i<missing.length;i+=batchSize){signal?.throwIfAborted();const batch=missing.slice(i,i+batchSize),tensor=await extractor(batch.map(x=>x.input),{pooling:'mean',normalize:true,truncation:true,max_length:512}),vectors=tensor.tolist();
    for(let j=0;j<batch.length;j++){const item=batch[j],record={input:item.input,vector:vectors[j]};if(record.vector.length!==384||record.vector.some(v=>!Number.isFinite(v)))throw Error('Invalid embedding');for(const index of item.indices)results[index]=record.vector;memory.set(item.key,record);await write(item.key,record);}
   }if(memory.size>10000)memory.clear();return results;
  });queue=task.catch(()=>{});return task;
 };
}
