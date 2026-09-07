import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';

export function publicAddress(address) {
  if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19)));}
  return isIP(address)===6 && /^[23]/i.test(address) && !/^2001:db8:/i.test(address);
}
// Every redirect is revalidated. Pin the validated DNS address to the socket,
// rather than validating once and allowing a second lookup (DNS rebinding).
export async function publicFetch(address,{limit=16*1024*1024,signal,redirects=4}={}) {
  signal?.throwIfAborted();
  const url=new URL(address);
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))throw new Error('Only public HTTPS sources are supported.');
  const host=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await lookup(host,{all:true});
  if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('Private/local network downloads are blocked.');
  const selected=addresses[0];
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000),headers:{'User-Agent':'LitGraph/0.2 (+https://openalex.org)','Accept':'*/*','Accept-Encoding':'identity'},lookup:(_host,options,cb)=>options.all?cb(null,[selected]):cb(null,selected.address,selected.family)},res=>{
      if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.resume();if(!redirects)return reject(new Error('Too many download redirects.'));try{publicFetch(new URL(res.headers.location,url).href,{limit,signal,redirects:redirects-1}).then(resolve,reject);}catch(error){reject(error);}return;}
      if(res.statusCode<200||res.statusCode>=300){res.resume();return reject(Object.assign(new Error(`Source HTTP ${res.statusCode}`),{status:res.statusCode}));}
      if(Number(res.headers['content-length'])>limit){res.destroy();return reject(new Error('Source exceeds size limit.'));}
      const chunks=[];let size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>limit){res.destroy();reject(new Error('Source exceeds size limit.'));}else chunks.push(chunk);});
      res.on('end',()=>resolve({bytes:Buffer.concat(chunks),url:url.href,type:res.headers['content-type']||''}));res.on('error',reject);
    });req.on('error',reject);
  });
}
export async function publicJson(url,options={}) {
  for(let attempt=0;;attempt++)try{return JSON.parse((await publicFetch(url,options)).bytes.toString('utf8'));}catch(error){if(attempt>=2||![429,502,503,504].includes(error.status))throw error;await new Promise(r=>setTimeout(r,1000*2**attempt));options.signal?.throwIfAborted();}
}
