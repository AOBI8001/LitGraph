import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
const root=process.cwd();await mkdir('output/desktop',{recursive:true});const dataDir=await mkdtemp(path.join(root,'output/desktop/collection-'));
let app,reviewCalls=0,finalCalls=0;const ids=new Set(),errors=[];
const mock=http.createServer(async(req,res)=>{try{
 let raw='';for await(const c of req)raw+=c;const input=JSON.parse(raw),body=JSON.parse(input.messages.at(-1).content);let result;
 if(body.collection_reviews){finalCalls++;assert.equal(body.scope.paperCount,50);assert.equal(body.scope.papersReviewed,50);assert.ok(body.scope.papersWithRetrievedEvidence<=50);assert.equal(body.scope.fullScopeRepresented,body.scope.papersWithRetrievedEvidence===50);result={answer:`测试夹具：本次逐篇检查范围为 50 篇。[${body.allowed_evidence_ids[0]}]`,suggested_followups:['哪些论文有问卷证据？','如何比较实验方法？','有哪些证据限制？']};}
 else{reviewCalls++;assert.ok(body.documents.length<=8);assert.equal(body.retrieval_status.strategy,'scope-coverage');result={papers:body.documents.map(n=>{ids.add(n.id);return {paperId:n.id,status:'supported',finding:'Source candidate for method review.',evidenceIds:body.evidence.filter(e=>e.documentId===n.id).slice(0,1).map(e=>e.id)};})};}
 if(input.stream){res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify(result)}}]})+'\n\ndata: [DONE]\n\n');}
 else{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));}
 }catch(e){errors.push(e.message);res.writeHead(500);res.end(JSON.stringify({error:{message:e.message}}));}});await new Promise(r=>mock.listen(0,'127.0.0.1',r));
const env={...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataDir};delete env.ELECTRON_RUN_AS_NODE;
try{
 app=await electron.launch({executablePath:process.env.LITGRAPH_TEST_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.LITGRAPH_TEST_EXECUTABLE?[]:[root],env,timeout:60000});
 const page=await app.firstWindow();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));await page.locator('#node-count').waitFor();
 await page.evaluate(endpoint=>window.litgraphDesktop.saveConfig({provider:'deepseek',model:'deepseek-chat',apiKey:'local-fixture',endpoint,protocol:'openai-chat',verified:true}),`http://127.0.0.1:${mock.address().port}`);await page.reload();
 await page.locator('#empty-sample-project').click();await page.waitForFunction(()=>document.querySelector('#node-count').textContent==='50');
 await page.locator('#research-desk-entry').click();await page.locator('#deep-read-input').fill('哪些论文使用了问卷法');await page.locator('.research-send').click();
 await page.waitForFunction(()=>['done','error'].includes(JSON.parse(localStorage.getItem('litgraph.chat.v2.sample-project.project.')||'[]').at(-1)?.status),{},{timeout:180000});
 const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('litgraph.chat.v2.sample-project.project.')).at(-1));assert.equal(record.status,'done',record.text);assert.equal(record.reviewLedger.length,50);assert.equal(ids.size,50);assert.equal(reviewCalls,7);assert.equal(finalCalls,1);assert.doesNotMatch(record.text,/已提供原文或摘要摘录|按摘录覆盖|Scope: 50 papers/);assert.ok(record.sources.length);assert.deepEqual(errors,[]);
 await page.reload();
 const cardCount=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('litgraph-fulltext',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('documents','readonly'),q=tx.objectStore('documents').getAllKeys();q.onsuccess=()=>resolve(q.result.filter(k=>String(k).startsWith('paper-card:')).length);q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}));assert.equal(cardCount,50);
 await page.locator('#research-desk-entry').click();await page.screenshot({path:path.join(dataDir,'answer.png')});
 const report={passed:true,dataDir,reviewCalls,finalCalls,coveredPapers:ids.size,persistedCards:cardCount,elapsedMsMock:record.elapsedMs,limitations:'Mock answer model; UI, native retrieval, persistence and coverage only, not answer-quality measurement.'};await writeFile(path.join(dataDir,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await app?.close().catch(()=>{});mock.closeAllConnections();await new Promise(r=>mock.close(r));}
