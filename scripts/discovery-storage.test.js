import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {localService} from './local-service.js';
const root=await mkdtemp(path.join(tmpdir(),'litgraph-persistence-test-'));
const pdf=Buffer.from('%PDF-1.4\nSynthetic storage fixture, not a real paper.');
const paper={recordId:'verified',title:'Storage fixture',doi:'10.1234/test',authors:['A','B'],year:2024,isOpenAccess:true,pdfUrls:['https://example.org/p.pdf']};
const dependencies={scholarly:{search:async()=>({papers:[paper]}),enrich:async p=>({...p,referenceDois:['10.1234/reference']})},download:async()=>({bytes:pdf,url:'https://example.org/p.pdf'})};
let middleware=localService(root,dependencies);
const server=http.createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/__litgraph/`;
async function call(route,data,token){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};}
try{
 const token=(await call('bootstrap',{})).data.browserToken;await call('search',{},token);
 assert.equal((await call('acquire',{recordId:'invented'},token)).status,400);
 const acquired=(await call('acquire',{recordId:'verified',projectId:'project',nodeId:'node'},token)).data;
 assert.equal(Buffer.from(acquired.data,'base64').toString(),pdf.toString());assert.ok(acquired.originalRelativePath);
 const saved=(await call('document',{projectId:'project',nodeId:'node',markdown:'# Original\n\nEvidence text',fileName:'paper.md'},token)).data;
 assert.equal((await readFile(path.join(root,saved.markdownRelativePath),'utf8')).includes('Evidence'),true);
 dependencies.download=async()=>({bytes:Buffer.from('<html>Sign in required</html>'),url:'https://example.org/login'});
 middleware=localService(root,dependencies);const restrictedToken=(await call('bootstrap',{})).data.browserToken;await call('search',{},restrictedToken);
 const unavailable=(await call('acquire',{recordId:'verified',projectId:'project',nodeId:'unavailable'},restrictedToken)).data;
 assert.equal(unavailable.status,'unavailable');assert.equal(unavailable.data,undefined);assert.equal(unavailable.originalRelativePath,undefined);assert.match(unavailable.error,/instead of a PDF/);
 const movedRoot=await mkdtemp(path.join(tmpdir(),'litgraph-moved-test-'));
 try{
  const {cp}=await import('node:fs/promises');await cp(path.join(root,'projects'),path.join(movedRoot,'projects'),{recursive:true});
  middleware=localService(movedRoot,dependencies);const fresh=(await call('bootstrap',{})).data.browserToken;
  const original=(await call('original',{key:saved.key},fresh)).data;assert.equal(Buffer.from(original.data,'base64').toString(),pdf.toString());
  assert.match((await call('document',{key:saved.key},fresh)).data.markdown,/Evidence/);
  assert.equal((await call('original',{key:'../../outside'},fresh)).data,null);
 }finally{await rm(movedRoot,{recursive:true,force:true});}
 console.log('Durable full text: verified acquisition, PDF + MD persistence, fresh session, moved project root and traversal rejection passed.');
}finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
