import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {evidenceOpening} from '../src/research-evidence.js';
const root=process.cwd();await mkdir('output/desktop',{recursive:true});const dataDir=await mkdtemp(path.join(root,'output/desktop/release125-'));
const requests=[],planningRequests=[];let expectedQuote='';
const mock=http.createServer(async(req,res)=>{
 try{let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body),payload=JSON.parse(input.messages.at(-1).content);
  if(payload.question&&!payload.evidence){planningRequests.push(payload);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({queries:['social observation experiment methods','comparison of observation procedures'],high_level_keywords:[],low_level_keywords:['observation'],sections:['methods']})}}]}));return;}
  requests.push(payload);
  assert.ok(payload.allowed_evidence_ids.length>0);const selected=payload.evidence.find(e=>e.text.split(/\s+/).length>=30)||payload.evidence[0];expectedQuote=evidenceOpening(selected.text).replace(/\s+/g,' ');
  const answer=requests.length===1?`原文说明了观察条件。[${selected.id}] 这项额外说法需要核验。[E99988]`:`继续依据本次原文作答。【${selected.id}】`;
  const result=JSON.stringify({answer,suggested_followups:['如何设置观察条件？','有哪些证据限制？','怎样比较研究方法？']});
  res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: '+JSON.stringify({choices:[{delta:{content:result}}]})+'\n\ndata: [DONE]\n\n');
 }catch(error){res.writeHead(500);res.end(JSON.stringify({error:{message:error.message}}));}
});await new Promise(r=>mock.listen(0,'127.0.0.1',r));
const env={...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataDir};delete env.ELECTRON_RUN_AS_NODE;let app;const errors=[],nativeLog=[];
try{
 app=await electron.launch({executablePath:process.env.LITGRAPH_TEST_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.LITGRAPH_TEST_EXECUTABLE?[]:[root],env,timeout:60000});app.process().stderr?.on('data',data=>{nativeLog.push(String(data));if(nativeLog.length>30)nativeLog.shift();});const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('#node-count').waitFor();
 await page.locator('#empty-sample-project').click();await page.waitForFunction(()=>document.querySelector('#node-count').textContent==='50');
 await page.evaluate(async endpoint=>{await window.litgraphDesktop.saveConfig({provider:'deepseek',model:'deepseek-chat',apiKey:'local-fixture-not-secret',endpoint,protocol:'openai-chat',verified:true});},`http://127.0.0.1:${mock.address().port}`);await page.reload();await page.locator('#node-count').waitFor();
 await page.evaluate(async()=>{const boot=await fetch('/__litgraph/bootstrap',{method:'POST'}).then(r=>r.json());window.fixtureIndexStatus=async()=>fetch('/__litgraph/vector-index',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+boot.browserToken},body:JSON.stringify({operation:'status'})}).then(r=>r.json());});
 const indexDeadline=Date.now()+90000;
 while(Date.now()<indexDeadline){const current=await page.evaluate(async()=>window.fixtureLastStatus=await window.fixtureIndexStatus());if(current.ready===50)break;await new Promise(r=>setTimeout(r,300));}
 const status=await page.evaluate(()=>window.fixtureLastStatus);assert.equal(status.failed,0);assert.equal(status.documents,50);assert.equal(status.ready,50);console.log(JSON.stringify({stage:'sample-ready',ready:status.ready,chunks:status.completedChunks}));
 await page.locator('#research-desk-entry').click();
 const ask=async(question,count)=>{await page.locator('#deep-read-input').fill(question);await page.locator('.research-send').click();await page.waitForFunction(n=>{const records=JSON.parse(localStorage.getItem('litgraph.chat.v2.sample-project.project.')||'[]');return records.filter(r=>r.role==='assistant').length===n&&['done','error'].includes(records.at(-1)?.status);},count,{timeout:30000});return page.evaluate(()=>JSON.parse(localStorage.getItem('litgraph.chat.v2.sample-project.project.')).at(-1));};
 const first=await ask('被他人观察会怎样影响抑制控制',1);assert.equal(first.status,'done',first.text);assert.match(first.text,/引用未核验：E99988/);assert.ok(!first.text.includes('Unknown evidence ID'));assert.ok(first.text.replace(/\\([\\`*_{}\[\]])/g,'$1').includes(expectedQuote));assert.ok(expectedQuote.split(/\s+/).length>=10);
 const second=await ask('观察条件中使用了什么装置',2);assert.equal(second.status,'done',second.text);assert.equal(requests.length,2);assert.ok(!JSON.stringify(requests[1].recent_conversation).includes('[E99988]'));
 for(const request of requests){assert.match(request.retrieval_status.method,/ready-dense/);assert.equal(request.retrieval_status.limited,false,request.retrieval_status.notice);}
 assert.equal(planningRequests.length,1,'Only the detailed fact query should call the query planner');assert.deepEqual(planningRequests[0].papers,[],'Do not send all library titles to the planner');
 assert.equal(second.sources.length,1);assert.deepEqual(errors,[]);await page.screenshot({path:'output/desktop/125-research.png'});
 console.log(JSON.stringify({passed:true,dataDir,indexReady:status.ready,chunks:status.completedChunks,calls:requests.length,checks:['all sample indexes prepared before first question','native local dense search used','unknown reference is labelled without failing answer','original quotation >=10 words','second-turn citation isolation']}));
}catch(error){console.error(JSON.stringify({dataDir,errors,nativeLog,exitCode:app?.process().exitCode}));try{console.error(JSON.stringify({status:await (await app.firstWindow()).evaluate(async()=>{const s=await window.fixtureIndexStatus();return {...s,states:s.states.filter(x=>x.state==='failed').slice(0,3)};}),requests:requests.map(r=>r.retrieval_status)}));}catch{}throw error;}
finally{await app?.close().catch(()=>{});mock.closeAllConnections();await new Promise(r=>mock.close(r));}
