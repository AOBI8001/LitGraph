// Fresh profile; live mode copies only the device-encrypted API configuration.
// Never print credentials or copy the user's projects into a distributable.
import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,copyFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
const root=process.cwd(),live=process.argv.includes('--live'),baseline=process.argv.includes('--baseline');
await mkdir('output/desktop',{recursive:true});
const dataDir=await mkdtemp(path.join(root,'output/desktop/research-130-'));
const ids=['paper-036','paper-037','paper-038','paper-039','paper-040'];
const tab={id:`selected.${ids.join('.')}`,type:'selected',nodeIds:ids,label:'已选 5 篇'};
let app,mock,requests=0,fixture=0;
const replies=[
 '{"answer":"研究设计不同：实验操纵与综述汇总回答的问题不同。[E1]\\n\\n应分别核对任务、样本和测量指标。[E5]"}',
 '{"answer":"方法比较需要区分实验任务与测量结果。[E1]\\n\\n不能把设计差异直接当作效果差异。[E5]", "suggested_followups": ["核对哪些任务？",]}',
 '这些论文使用不同研究设计，需分别比较操纵条件与测量指标。[E1]\n\n【AI 推断】任务差异可能影响可比性。[E5]',
 JSON.stringify({answer:'比较任务、样本与测量三方面的区别。[E1][E5]',suggested_followups:['样本有哪些不同？','如何测量反应？','哪些设计可直接比较？']}),
 '{"answer":"已收到的方法说明需要核验。[E1]'
];
if(live){
 await copyFile(path.join(process.env.APPDATA,'litgraph/model-config.encrypted'),path.join(dataDir,'model-config.encrypted'));
 // Chromium's encrypted key is stored separately from the encrypted config.
 await copyFile(path.join(process.env.APPDATA,'litgraph/Local State'),path.join(dataDir,'Local State'));
}
else {
 mock=http.createServer(async(req,res)=>{try{
  let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw),p=JSON.parse(body.messages.at(-1).content);requests++;
  assert.equal(p.scope.paperCount,5);assert.equal(new Set(p.evidence.map(e=>e.documentId)).size,5);
  assert.equal(body.thinking.type,p.response_mode==='expert'?'enabled':'disabled');
  if(p.response_mode==='quick')assert.match(p.response_guidance,/350–600/);
  const reply=replies[fixture++];assert.ok(reply);
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  for(const piece of [reply.slice(0,Math.floor(reply.length/2)),reply.slice(Math.floor(reply.length/2))]){
   res.write(`data: ${JSON.stringify({choices:[{delta:{content:piece}}]})}\n\n`);
   await new Promise(r=>setTimeout(r,250));
  }
  res.end('data: '+JSON.stringify({choices:[{delta:{},finish_reason:fixture===5?'length':'stop'}]})+'\n\ndata: [DONE]\n\n');
 }catch(e){res.writeHead(500);res.end(JSON.stringify({error:{message:e.message}}));}});
 await new Promise(r=>mock.listen(0,'127.0.0.1',r));
}
const env={...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataDir};delete env.ELECTRON_RUN_AS_NODE;
try{
 app=await electron.launch({executablePath:process.env.LITGRAPH_TEST_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.LITGRAPH_TEST_EXECUTABLE?[]:[root],env,timeout:60000});
 const page=await app.firstWindow();page.setDefaultTimeout(30000);await page.locator('#node-count').waitFor();
 if(live)assert.ok(await page.evaluate(()=>Boolean(window.litgraphDesktop.bootstrap()?.config?.apiKey)),'Encrypted config unavailable; no live request sent');
 else {await page.evaluate(endpoint=>window.litgraphDesktop.saveConfig({provider:'deepseek',model:'deepseek-flash',apiKey:'local-fixture',endpoint,protocol:'openai-chat',verified:true}),`http://127.0.0.1:${mock.address().port}`);await page.reload();}
 await page.locator('#empty-sample-project').click();await page.waitForFunction(()=>document.querySelector('#node-count').textContent==='50');
 await page.evaluate(tab=>localStorage.setItem('litgraph.researchTabs.sample-project',JSON.stringify([{id:'project',type:'project',nodeIds:[]},tab])),tab);
 await page.reload();await page.locator('#research-desk-entry').click();await page.locator('[data-research-tab]').filter({hasText:'已选 5 篇'}).click();
 const chatKey=await page.evaluate(()=>document.querySelector('[data-chat-key]').dataset.chatKey);
 const cases=baseline?['expert']:live?['expert','quick']:['expert','expert','expert','quick','expert'];
 const reports=[];
 for(const mode of cases){
  await page.evaluate(()=>{window.testStream='';window.testUnsubscribe?.();window.testUnsubscribe=window.litgraphDesktop.onModelChunk(e=>window.testStream+=e.text);});
  await page.locator('#research-response-mode').selectOption(mode);
  await page.locator('#deep-read-input').fill('比较这些研究方法上的差异');await page.locator('.research-send').click();
  await page.waitForFunction(key=>['done','error'].includes(JSON.parse(localStorage.getItem(key)||'[]').at(-1)?.status),chatKey,{timeout:300000});
  const record=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).at(-1),chatKey);
  const frames=(await page.evaluate(()=>window.testStream)).split('\n').filter(s=>s.startsWith('data:')).map(s=>{try{return JSON.parse(s.slice(5));}catch{return null;}}).filter(Boolean);
  const answer=frames.map(e=>e.choices?.[0]?.delta?.content||'').join('');
  let parsed,parseError;try{parsed=JSON.parse(answer);}catch(e){parseError=e.message;}
  const report={mode,status:record.status,elapsedMs:record.elapsedMs,answerCharacters:record.text?.split('证据来源：')[0].length,sources:record.sources?.length,followups:record.suggested_followups?.length,replyCharacters:answer.length,parseError,keys:parsed?Object.keys(parsed):[],finish:frames.flatMap(e=>e.choices?.map(c=>c.finish_reason).filter(Boolean)||[])};
  reports.push(report);console.log(JSON.stringify(report));
  await writeFile(path.join(dataDir,`${mode}-${reports.length}-reply.json`),JSON.stringify({answer,record},null,2));
  if(!live&&reports.length===5){
   assert.equal(record.status,'error');assert.match(record.partialText,/已收到的方法说明/);assert.match(record.partialText,/原句/);
   await page.locator('[data-incomplete-answer]').waitFor();assert.match(await page.locator('.deep-read-history').innerText(),/尚未完成/);
  }else if(!baseline){assert.equal(record.status,'done',record.text);assert.ok(record.sources.length>0);assert.doesNotMatch(record.text,/无法完成分析|suggested_followups/);assert.ok(record.suggested_followups.length<=3);}
 }
 if(!live)assert.equal(requests,cases.length,'No extra formatting-repair model call');
 await writeFile(path.join(dataDir,'result.json'),JSON.stringify({live,baseline,reports},null,2));
 await page.screenshot({path:path.join(dataDir,'answer.png')});console.log(JSON.stringify({passed:true,dataDir}));
}finally{await app?.close().catch(()=>{});mock?.closeAllConnections();if(mock)await new Promise(r=>mock.close(r));}
