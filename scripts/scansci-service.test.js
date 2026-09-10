import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDecipheriv} from 'node:crypto';
import {scansciService,validInstitution,publicAddress} from './scansci-service.js';
import {routeInstitution} from './institution-routing.js';
import {acquisitionCore,isCompletePdf} from './acquisition-core.js';
const pdf=Buffer.from('%PDF-1.4\nSynthetic core fixture.\n%%EOF');
const seed={doi:'10.1234/test',isOpenAccess:true,pdfUrls:['https://example.org/p.pdf']};
const waitForAbort=signal=>new Promise((_,reject)=>{if(signal.aborted)reject(signal.reason);else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});

test('Native core needs no Python runtime and keeps one scholarly search path',async()=>{
 let calls=0;
 const engine=scansciService('Z:/does-not-exist',{scholarly:{search:async input=>{calls++;return {papers:[input]};}}});
 assert.equal((await engine.status()).available,true);
 assert.equal((await engine.search({queries:['topic']})).papers.length,1);assert.equal(calls,1);
});
test('Known PDF fast path preserves full metadata and never waits for enrichment',async()=>{
 const paper={...seed,authors:Array.from({length:9},(_,i)=>'Author '+i),abstract:'evidence '.repeat(200)};
 const acquire=acquisitionCore({scholarly:{enrich:()=>{throw Error('must not enrich');},resolveOpenAccess:()=>{throw Error('must not resolve');}},download:async()=>({bytes:pdf})});
 const result=await acquire(paper);
 assert.equal(result.success,true);assert.equal(result.metadata.authors.length,9);assert.equal(result.metadata.abstract,paper.abstract);
 assert.deepEqual(result.bytes,pdf);assert.equal(result.attempts.length,1);
});
test('First successful copy returns promptly and cancels the hung alternative',async()=>{
 let cancelled=false;
 const acquire=acquisitionCore({download:async(address,{signal})=>{
   if(address.endsWith('slow.pdf')){try{await waitForAbort(signal);}finally{cancelled=true;}}
   return {bytes:pdf};
 }});
 const started=Date.now();
 const result=await acquire({...seed,pdfUrls:['https://example.org/slow.pdf','https://example.org/fast.pdf']});
 assert.equal(result.success,true);assert.ok(Date.now()-started<1000);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,true);
});
test('Publisher denial falls back to verified repository; each URL visited once',async()=>{
 const visited=[];
 const acquire=acquisitionCore({
  scholarly:{resolveOpenAccess:async p=>({...p,pdfUrl:'https://repository.org/p.pdf',fulltextRepository:'Official repository'}),enrich:async p=>p},
  download:async address=>{visited.push(address);if(address.includes('example'))throw Object.assign(Error('Source HTTP 403'),{status:403});return {bytes:pdf};}
 });
 const result=await acquire(seed);
 assert.equal(result.success,true);assert.equal(result.source,'Official repository');
 assert.deepEqual(visited,['https://example.org/p.pdf','https://repository.org/p.pdf']);
 assert.equal(result.attempts[0].code,'access_denied');
});
test('Advertised article PDF followed; incomplete originals not saved',async()=>{
 const acquire=acquisitionCore({download:async address=>address.endsWith('/p.pdf')?{bytes:Buffer.from('<meta name="citation_pdf_url" content="/real.pdf">'),url:address}:{bytes:pdf}});
 assert.equal((await acquire(seed)).success,true);
 const broken=acquisitionCore({download:async()=>({bytes:Buffer.from('%PDF-1.4 truncated')})});
 assert.equal((await broken(seed)).success,false);assert.equal(isCompletePdf(Buffer.from('<html>Login</html>')),false);
});
test('Long publisher lists cannot starve the verified repository fallback',async()=>{
 const visited=[];
 const acquire=acquisitionCore({scholarly:{resolveOpenAccess:async p=>({...p,pdfUrl:'https://repository.org/good.pdf',fulltextRepository:'Official repository'})},download:async address=>{visited.push(address);if(address.endsWith('good.pdf'))return {bytes:pdf};throw Object.assign(Error('Source HTTP 403'),{status:403});}});
 const result=await acquire({...seed,pdfUrls:Array.from({length:6},(_,i)=>'https://example.org/'+i+'.pdf')});
 assert.equal(result.success,true);assert.ok(visited.includes('https://repository.org/good.pdf'));assert.ok(visited.length<=4);
});
test('Late PMCID enrichment takes precedence over remaining failed direct URLs',async()=>{
 const visited=[];
 const acquire=acquisitionCore({scholarly:{resolveOpenAccess:async p=>p.pmcid?{...p,pdfUrl:'https://repository.org/good.pdf',fulltextRepository:'Official repository'}:p,enrich:async p=>({...p,pmcid:'PMC123'})},download:async address=>{visited.push(address);if(address.endsWith('good.pdf'))return {bytes:pdf};throw Object.assign(Error('Source HTTP 403'),{status:403});}});
 const result=await acquire({...seed,pdfUrls:Array.from({length:6},(_,i)=>'https://example.org/'+i+'.pdf')});
 assert.equal(result.success,true);assert.equal(visited.length,3);assert.equal(result.source,'Official repository');
});
test('A landing page keeps capacity for the PDF it advertises',async()=>{
 const acquire=acquisitionCore({scholarly:{resolveOpenAccess:async p=>p,enrich:async p=>p},download:async address=>{
  if(address.endsWith('/article'))return {bytes:Buffer.from('<meta name="citation_pdf_url" content="/good.pdf">'),url:address};
  if(address.endsWith('good.pdf'))return {bytes:pdf};
  throw Object.assign(Error('Source HTTP 403'),{status:403});
 }});
 const result=await acquire({...seed,pdfUrls:Array.from({length:5},(_,i)=>'https://example.org/'+i+'.pdf'),oaLandingUrls:['https://repository.org/article']});
 assert.equal(result.success,true);assert.equal(result.attempts.length,4);
});
test('Hard deadline and explicit cancellation terminate acquisition',async()=>{
 const timer=setTimeout(()=>{},2000); // keep node alive while AbortSignal.timeout is unref'ed
 try{
  const acquire=acquisitionCore({totalMs:50,requestMs:1000,download:async(_,options)=>waitForAbort(options.signal)});
  const result=await acquire(seed);assert.equal(result.success,false);assert.equal(result.attempts[0].code,'timeout');
  const controller=new AbortController();
  const pending=acquisitionCore({download:async(_,options)=>waitForAbort(options.signal)})(seed,controller.signal);
  controller.abort();await assert.rejects(pending,{name:'AbortError'});
 }finally{clearTimeout(timer);}
});
test('Unchanged repository identity is not resolved twice',async()=>{
 let resolved=0;
 const acquire=acquisitionCore({scholarly:{resolveOpenAccess:async p=>{resolved++;return p;},enrich:async p=>p},download:async()=>{throw Object.assign(Error('Source HTTP 403'),{status:403});}});
 await acquire({...seed,pmcid:'PMC1234'});assert.equal(resolved,1);
});
test('Institution templates stay intact and private/credential URLs are rejected',()=>{
 assert.match(validInstitution({portalUrl:'https://library.example.edu/login?url={url}'}).portalUrl,/\{url\}/);
 for(const url of ['file:///C:/secret','http://127.1/a','http://10.0.0.1/a','http://[::1]/','https://user:pass@example.com/','https://foo.local/'])assert.throws(()=>publicAddress(url));
});
test('WebVPN core maps exact registered gateway, uses AES CFB, and does not double-wrap',()=>{
 const portalUrl='https://webvpn.hfut.edu.cn/';
 const result=routeInstitution({portalUrl,targetUrl:'https://www.nature.com/articles/paper?a=1&b=2'});
 assert.equal(result.method,'webvpn');
 const parts=new URL(result.url).pathname.split('/');
 assert.equal(parts[1],'https');
 const encrypted=Buffer.from(parts[2],'hex'),key=Buffer.from('wrdvpnisthebest!');
 const cipher=createDecipheriv('aes-128-cfb',key,encrypted.subarray(0,16));
 assert.equal(Buffer.concat([cipher.update(encrypted.subarray(16)),cipher.final()]).toString(),'www.nature.com');
 assert.equal(new URL(result.url).search,'?a=1&b=2');
 assert.equal(routeInstitution({portalUrl,targetUrl:result.url}).url,result.url);
 assert.equal(routeInstitution({portalUrl:'https://library.example.edu/',targetUrl:'https://www.nature.com/p'}).method,'publisher');
 assert.throws(()=>routeInstitution({portalUrl:'https://library.example.edu/',targetUrl:'https://www.nature.com/p',method:'webvpn'}),/no verified/);
});
test('EZProxy template preserves the complete target query',()=>{
 const targetUrl='https://publisher.org/article?a=1&b=2';
 const route=routeInstitution({portalUrl:'https://library.example.edu/login?url={url}',targetUrl});
 assert.equal(route.method,'ezproxy');assert.equal(new URL(route.url).searchParams.get('url'),targetUrl);
 assert.throws(()=>routeInstitution({portalUrl:'https://library.example.edu/',targetUrl,method:'ezproxy'}),/\{url\}/);
});
