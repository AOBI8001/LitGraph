import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {setTimeout as wait} from 'node:timers/promises';

export function publicAddress(address) {
  if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19)));}
  return isIP(address)===6 && /^[23]/i.test(address) && !/^2001:db8:/i.test(address);
}
function abortable(promise,signal) {
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const cancel=()=>reject(signal.reason);signal.addEventListener('abort',cancel,{once:true});
    Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
  });
}
// Dependency injection is for offline network tests. Every production redirect
// revalidates all DNS answers and pins a validated address to the socket.
export function createPublicFetcher({resolveDns=lookup,get=https.get,timeoutMs=30000,connectTimeoutMs=8000,headerTimeoutMs=12000}={}) {
  return async function fetchPublic(address,{limit=16*1024*1024,signal,redirects=4}={}) {
    signal?.throwIfAborted();
    const deadline=signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs);
    const url=new URL(address);
    if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))throw new Error('Only public HTTPS sources are supported.');
    const host=url.hostname.replace(/^\[|\]$/g,'');
    const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await abortable(resolveDns(host,{all:true}),deadline);
    if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('Private/local network downloads are blocked.');
    let lastError;
    for(const selected of [...new Map(addresses.map(a=>[a.address,a])).values()].slice(0,3)) {
      deadline.throwIfAborted();
      try {
        const response=await new Promise((resolve,reject)=>{
          let connectTimer,headerTimer,settled=false;
          const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(connectTimer);clearTimeout(headerTimer);error?reject(error):resolve(result);};
          const req=get(url,{signal:deadline,headers:{'User-Agent':'LitGraph/1.0 (+https://github.com/AOBI8001/LitGraph)','Accept':'*/*','Accept-Encoding':'identity'},lookup:(_host,options,cb)=>options.all?cb(null,[selected]):cb(null,selected.address,selected.family)},res=>{
            clearTimeout(connectTimer);clearTimeout(headerTimer);
            if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.resume();try{return finish(null,{redirect:new URL(res.headers.location,url).href});}catch(error){return finish(error);}}
            if(res.statusCode<200||res.statusCode>=300){res.resume();return finish(Object.assign(new Error(`Source HTTP ${res.statusCode}`),{status:res.statusCode}));}
            if(Number(res.headers['content-length'])>limit){res.destroy();return finish(new Error('Source exceeds size limit.'));}
            const chunks=[];let size=0;
            res.on('data',chunk=>{size+=chunk.length;if(size>limit){res.destroy();finish(new Error('Source exceeds size limit.'));}else chunks.push(chunk);});
            res.on('end',()=>finish(null,{bytes:Buffer.concat(chunks),url:url.href,type:res.headers['content-type']||''}));res.on('error',error=>finish(error));
          });
          const timedOut=()=>req.destroy(Object.assign(new Error('Source connection timed out.'),{code:'ETIMEDOUT'}));
          connectTimer=setTimeout(timedOut,connectTimeoutMs);headerTimer=setTimeout(timedOut,headerTimeoutMs);
          req.on('socket',socket=>{if(socket.connecting)socket.once('secureConnect',()=>clearTimeout(connectTimer));else clearTimeout(connectTimer);});
          req.on('error',error=>finish(error));
        });
        if(response.redirect){if(!redirects)throw new Error('Too many download redirects.');return fetchPublic(response.redirect,{limit,signal:deadline,redirects:redirects-1});}
        return response;
      }catch(error){
        deadline.throwIfAborted();lastError=error;
        // HTTP denials are authoritative; changing IPs must not be used to
        // circumvent access controls. Only connection failures try another IP.
        if(!['ETIMEDOUT','ECONNRESET','ECONNREFUSED','ENETUNREACH','EHOSTUNREACH','EPIPE'].includes(error.code))throw error;
      }
    }
    throw lastError;
  };
}
export const publicFetch=createPublicFetcher();
export async function publicJson(url,options={}) {
  for(let attempt=0;;attempt++)try{return JSON.parse((await publicFetch(url,options)).bytes.toString('utf8'));}catch(error){if(attempt>=2||![429,502,503,504].includes(error.status))throw error;await wait(1000*2**attempt,undefined,{signal:options.signal});options.signal?.throwIfAborted();}
}
