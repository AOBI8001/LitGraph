import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {mkdtemp,mkdir,readFile} from 'node:fs/promises';import path from 'node:path';import {localService} from './local-service.js';
test('bibliography-only persistence preserves Markdown, chunks and cached index; original replacement clears it',async()=>{
 await mkdir('output',{recursive:true});const dataRoot=await mkdtemp(path.join(process.cwd(),'output/bibliography-service-'));let enqueued=0,ocrCalls=0;const embed=async()=>[];embed.index=async()=>{enqueued++;};
 const middleware=localService(process.cwd(),{dataRoot,embed,documentOcr:async()=>{ocrCalls++;return {supported:false,lines:[]};}}),server=http.createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}/__litgraph/`;
 const call=async(route,body,token='')=>{const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 try{
  const token=(await call('bootstrap',{})).data.browserToken;
  const saved=(await call('document',{projectId:'fixture',nodeId:'paper',fileName:'synthetic.md',markdown:'# Synthetic document\n\nEvidence lines must stay unchanged.\n'},token)).data;
  const md=await readFile(path.join(dataRoot,'data/markdown',saved.key+'.md')),chunks=await readFile(path.join(dataRoot,'data/chunks',saved.key+'.json')),before=enqueued;
  const bibliography={version:1,info:{title:'Synthetic document',path:'omit'},pages:[{page:1,lines:[{text:'Synthetic document',size:20,x:10,y:100}]}]};
  assert.equal((await call('document-bibliography',{key:saved.key,bibliography},token)).status,200);
  assert.deepEqual(await readFile(path.join(dataRoot,'data/markdown',saved.key+'.md')),md);assert.deepEqual(await readFile(path.join(dataRoot,'data/chunks',saved.key+'.json')),chunks);assert.equal(enqueued,before);
  const record=JSON.parse(await readFile(path.join(dataRoot,'data/records',saved.key+'.json')));assert.equal(record.bibliography.info.title,'Synthetic document');assert.equal(record.bibliography.info.path,undefined);
  assert.equal((await call('document-bibliography',{key:'../bad',bibliography},token)).status,400);
  assert.equal((await call('document-ocr',{image:'ignored-fixture'},'invalid')).status,401);assert.equal(ocrCalls,0);
  assert.equal((await call('document-ocr',{image:'ignored-fixture'},token)).status,200);assert.equal(ocrCalls,1);
  await call('document',{projectId:'fixture',nodeId:'paper',fileName:'synthetic.pdf',originalData:Buffer.from('%PDF-1.4\n% synthetic source fixture\n%%EOF').toString('base64'),replaceOriginal:true},token);
  const replaced=JSON.parse(await readFile(path.join(dataRoot,'data/records',saved.key+'.json')));assert.equal(replaced.bibliography,undefined);assert.equal(replaced.markdown,undefined);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
