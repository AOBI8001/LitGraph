import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createPublicFetcher} from './public-fetch.js';

const calls=[];
const addresses=[{address:'8.8.8.8',family:4},{address:'1.1.1.1',family:4}];
const get=(url,options,respond)=>{
 const request=new EventEmitter();request.destroy=error=>{request.emit('error',error);};
 options.lookup(url.hostname,{},(error,address)=>{
  if(error)throw error;calls.push(address);
  queueMicrotask(()=>{
   if(address==='8.8.8.8')return request.emit('error',Object.assign(Error('connection reset'),{code:'ECONNRESET'}));
   const response=new PassThrough();response.statusCode=200;response.headers={'content-type':'application/pdf'};respond(response);response.end('%PDF-1.4 fixture');
  });
 });return request;
};
const fetcher=createPublicFetcher({resolveDns:async()=>addresses,get});
assert.match((await fetcher('https://example.org/p.pdf')).bytes.toString(),/^%PDF/);
assert.deepEqual(calls,['8.8.8.8','1.1.1.1']);

let requests=0;
const denied=createPublicFetcher({resolveDns:async()=>addresses,get:(_url,_options,respond)=>{
 requests++;const request=new EventEmitter();request.destroy=error=>request.emit('error',error);
 queueMicrotask(()=>{const response=new PassThrough();response.statusCode=403;response.headers={};respond(response);response.end();});return request;
}});
await assert.rejects(()=>denied('https://example.org/protected'),/Source HTTP 403/);assert.equal(requests,1);
const blocked=createPublicFetcher({resolveDns:async()=>[addresses[0],{address:'127.0.0.1',family:4}],get:()=>{throw Error('Must never connect');}});
await assert.rejects(()=>blocked('https://example.org/'),/Private\/local/);

const controller=new AbortController();
const slowDns=createPublicFetcher({resolveDns:()=>new Promise(()=>{}),get:()=>{throw Error('Must never connect');}});
const request=slowDns('https://example.org/',{signal:controller.signal});controller.abort();
await assert.rejects(()=>request,{name:'AbortError'});

let redirectedRequests=0;
const redirect=createPublicFetcher({resolveDns:async host=>host==='example.org'?addresses:[{address:'127.0.0.1',family:4}],get:(_url,_options,respond)=>{
 redirectedRequests++;const request=new EventEmitter();request.destroy=error=>request.emit('error',error);
 queueMicrotask(()=>{const response=new PassThrough();response.statusCode=302;response.headers={location:'https://private.example/secret'};respond(response);response.end();});return request;
}});
await assert.rejects(()=>redirect('https://example.org/'),/Private\/local/);assert.equal(redirectedRequests,1);
console.log('Public downloads: alternative validated IPs, no retry of HTTP denials, DNS cancellation and redirect SSRF rejection passed.');
