// Integration test in a fresh profile. --live reuses only the encrypted model
// configuration, never the user's projects/history, and never logs credentials.
import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,copyFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
const root=process.cwd(),live=process.argv.includes('--live');
await mkdir('output/desktop',{recursive:true});const dataDir=await mkdtemp(path.join(root,'output/desktop/overview-'));
let requests=0,app,mock;
if(live)await copyFile(path.join(process.env.APPDATA,'litgraph/model-config.encrypted'),path.join(dataDir,'model-config.encrypted'));
else {mock=http.createServer(async(req,res)=>{try{
 let raw='';for await(const chunk of req)raw+=chunk;const p=JSON.parse(JSON.parse(raw).messages.at(-1).content);requests++;
 assert.equal(p.scope.paperCount,50);assert.equal(p.scope.papersWithRetrievedEvidence,50);assert.equal(p.documents.length,50);assert.equal(p.scope.fullScopeRepresented,true);assert.equal(p.retrieval_status.strategy,'collection-overview');assert.equal(p.coverage.length,50);
 assert.equal(new Set(p.evidence.map(e=>e.documentId)).size,50);
 const answer=JSON.stringify({answer:'这些文献共同考察抑制控制、社会情境与测量可靠性。[E1][E50]\n\n本次共 50 篇论文，只有 7 篇送回了片段，且每篇均为少量摘录而非完整正文；其余 43 篇本次未送回任何片段，因此无法判断它们是否提到观察。',suggested_followups:['社会观察涉及哪些研究？','哪些论文研究测量信度？','哪些研究比较临床人群？']});res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: '+JSON.stringify({choices:[{delta:{content:answer}}]})+'\n\ndata: [DONE]\n\n');
 }catch(e){res.writeHead(500);res.end(JSON.stringify({error:{message:e.message}}));}});await new Promise(r=>mock.listen(0,'127.0.0.1',r));}
const env={...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataDir};delete env.ELECTRON_RUN_AS_NODE;
try {
 app=await electron.launch({executablePath:process.env.LITGRAPH_TEST_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.LITGRAPH_TEST_EXECUTABLE?[]:[root],env,timeout:60000});
 const page=await app.firstWindow();page.setDefaultTimeout(30000);await page.locator('#node-count').waitFor();
 console.log(JSON.stringify({stage:'started',live,dataDir,model:await page.locator('#model-badge').innerText()}));
 if(live){const connected=await page.evaluate(()=>Boolean(window.litgraphDesktop.bootstrap()?.config?.apiKey));assert.ok(connected,'The isolated profile could not reuse the encrypted API configuration; no live request was sent.');}
 if(!live){await page.evaluate(endpoint=>window.litgraphDesktop.saveConfig({provider:'deepseek',model:'deepseek-chat',apiKey:'local-fixture',endpoint,protocol:'openai-chat',verified:true}),`http://127.0.0.1:${mock.address().port}`);await page.reload();}
 await page.locator('#empty-sample-project').click();await page.waitForFunction(()=>document.querySelector('#node-count').textContent==='50');
 console.log(JSON.stringify({stage:'sample-selected',live}));
 await page.locator('#research-desk-entry').click();await page.locator('#deep-read-input').fill('这些文献主要研究了一个什么问题');await page.locator('.research-send').click();
 await page.waitForFunction(()=>['done','error'].includes(JSON.parse(localStorage.getItem('litgraph.chat.v2.sample-project.project.')||'[]').at(-1)?.status),{},{timeout:180000});
 const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('litgraph.chat.v2.sample-project.project.')).at(-1));
 assert.equal(record.status,'done',record.text);assert.ok(record.sources.length>0);assert.ok(!record.text.includes('Unknown evidence ID'));assert.ok(!record.text.includes('fulltext_indexed_excerpts_only'));
 if(!live){assert.equal(requests,1,'Overview has one answer call, no planner call');assert.doesNotMatch(record.text,/送回|43 篇|按摘录覆盖/);assert.match(record.text,/抑制控制/);assert.match(record.text,/原句/);}
 const report={live,status:record.status,elapsedMs:record.elapsedMs,stageTimings:record.stageTimings,answer:record.text,citedSources:record.sources.map(s=>s.documentId)};
 await writeFile(path.join(dataDir,'result.json'),JSON.stringify(report,null,2));await page.screenshot({path:path.join(dataDir,'answer.png')});
 console.log(JSON.stringify({passed:true,live,dataDir,elapsedMs:record.elapsedMs,stageTimings:record.stageTimings,citedSources:record.sources.length}));
} catch(error){try{const page=await app.firstWindow();await page.screenshot({path:path.join(dataDir,'failure.png')});console.error(JSON.stringify({dataDir,error:error.message,ui:(await page.locator('body').innerText()).slice(-3000)}));}catch{}throw error;}
finally {await app?.close().catch(()=>{});mock?.closeAllConnections();if(mock)await new Promise(r=>mock.close(r));}
