import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,access,rename} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {emptyProject} from '../src/startup-project.js';
const root=process.cwd();await mkdir('output/desktop',{recursive:true});
const dataDir=await mkdtemp(path.join(root,'output/desktop/release123-'));
const library={};
for(const id of ['project-a','project-b']){const project=emptyProject(id);project.meta.title=id;
 const key=createHash('sha256').update(id+':same-paper').digest('hex');
 project.nodes=[{id:'same-paper',title:'International student regulations '+id,authors:['Fixture'],year:2024,primaryTheory:'unclassified',secondaryTheories:[],keywords:[],fulltextStatus:'indexed',analysisStatus:'done',fulltextKey:key,markdownRelativePath:'data/markdown/'+key+'.md',summary:'Fixture only.'}];
 library[id]={id,title:id,data:project};
 await mkdir(path.join(dataDir,'data/records'),{recursive:true});await mkdir(path.join(dataDir,'data/markdown'),{recursive:true});
 const markdown='## PDF Page 1\nMethods\n\nInternational students must follow the university visa requirements. This is synthetic test evidence.';
 await writeFile(path.join(dataDir,'data/records',key+'.json'),JSON.stringify({key,nodeId:'same-paper',projectId:id,markdown,sourceKind:'pdf_text'}));
 await writeFile(path.join(dataDir,'data/markdown',key+'.md'),markdown);
}
await writeFile(path.join(dataDir,'workspace-state.json'),JSON.stringify({'litgraph.projects.v1':JSON.stringify(library),'litgraph.activeProjectId':'project-a','litgraph.chat.v2.project-b.project.':JSON.stringify([{role:'user',text:'B_PRIVATE_HISTORY'}])}));
let calls=0,finishedAt=0;const mock=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body);calls++;assert.equal(input.stream,true);
 res.writeHead(200,{'Content-Type':'text/event-stream'});const delta=text=>res.write('data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n');
 delta('{"answer":"签证规范');setTimeout(()=>delta('依据学校文件。[E1]'),350);setTimeout(()=>{delta('","suggested_followups":["需要什么材料？","谁负责审核？","如何核对原文？"]}');res.end('data: [DONE]\n\n');finishedAt=Date.now();},2200);
});await new Promise(r=>mock.listen(0,'127.0.0.1',r));
const env={...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataDir};delete env.ELECTRON_RUN_AS_NODE;
let app;const errors=[];
try{
 app=await electron.launch({executablePath:process.env.LITGRAPH_TEST_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.LITGRAPH_TEST_EXECUTABLE?[]:[root],env,timeout:60000});let page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('#node-count').waitFor();
 await page.evaluate(async endpoint=>{await window.litgraphDesktop.saveConfig({provider:'deepseek',model:'deepseek-chat',apiKey:'local-fixture-not-secret',endpoint,protocol:'openai-chat',verified:true});},`http://127.0.0.1:${mock.address().port}`);await page.reload();await page.locator('#node-count').waitFor();
 await page.locator('#research-desk-entry').click();await page.locator('#deep-read-input').fill('留学生规范有哪些');await page.locator('.research-send').click();
 await page.locator('[data-stream-preview]').waitFor({timeout:20000});assert.equal(finishedAt,0,'Preview must appear before the HTTP response completes');
 assert.match(await page.locator('[data-stream-preview]').textContent(),/签证规范/);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('litgraph.chat.v2.project-a.project.')||'[]').at(-1)?.status==='done',null,{timeout:20000});assert.equal(calls,1,'Quick mode must not make a separate rewrite request');
 const timings=await page.evaluate(()=>JSON.parse(localStorage.getItem('litgraph.chat.v2.project-a.project.')).at(-1).stageTimings);assert.equal(timings.rewriting,undefined);
 await page.screenshot({path:'output/desktop/123-stream-result.png'});
 await page.locator('#project-selector-button').click();await page.locator('[data-project-id="project-b"]').click();assert.equal(await page.locator('.deep-read-window').count(),0);
 await page.locator('#research-desk-entry').click();assert.match(await page.locator('.deep-read-history').textContent(),/B_PRIVATE_HISTORY/);assert.ok(!(await page.locator('.deep-read-history').textContent()).includes('签证规范依据'));
 await page.locator('#project-selector-button').click();await page.locator('[data-project-id="project-a"]').click();await page.locator('#research-desk-entry').click();assert.ok(!(await page.locator('.deep-read-history').textContent()).includes('B_PRIVATE_HISTORY'));
 await page.locator('.deep-read-window [data-close]').click();await page.getByRole('button',{name:'设置',exact:true}).click();
 const order=await page.locator('.workspace-settings-list [data-workspace-action]').evaluateAll(es=>es.map(e=>e.dataset.workspaceAction));assert.equal(order[order.indexOf('data-folder')+1],'reset-settings');assert.equal(order[order.indexOf('reset-settings')+1],'clear-data');
 await page.screenshot({path:'output/desktop/123-settings.png'});
 // Native confirmation is stubbed ONLY inside this isolated synthetic profile.
 // The real recycle-bin operation is restricted to this synthetic test profile.
 await app.evaluate(({dialog,shell},profile)=>{const trash=shell.trashItem.bind(shell);globalThis.clearCalls=[];dialog.showMessageBox=async()=>({response:0});shell.trashItem=async target=>{if(!target.startsWith(profile+'\\'))throw Error('Outside test profile');globalThis.clearCalls.push(target);await trash(target);};},dataDir);
 assert.equal(await page.evaluate(()=>window.litgraphDesktop.clearData({}).then(r=>r.cleared)),false);await access(path.join(dataDir,'data'));
 await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
 await page.locator('[data-workspace-action="clear-data"]').click();await page.waitForFunction(()=>document.querySelector('#node-count')?.textContent==='0',null,{timeout:20000});
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('litgraph.projects.v1')));assert.equal(restored['sample-project'].data.nodes.length,50);assert.equal(restored['project-a'],undefined);assert.equal(await page.evaluate(()=>localStorage.getItem('litgraph.chat.v2.project-b.project.')),null);
 assert.ok((await app.evaluate(()=>globalThis.clearCalls)).every(p=>p.startsWith(dataDir)));await access(path.join(dataDir,'model-config.encrypted'));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,dataDir,calls,timings,checks:['true native SSE preview before completion','quick no rewrite','project A/B isolation','settings order','clear cancel','clear confirmed isolated data','bundled 50-paper sample retained','model configuration retained']}));
}catch(error){console.error(JSON.stringify({dataDir,calls,finishedAt,errors}));try{const page=await app.firstWindow();console.error((await page.locator('body').textContent()).slice(-6000));await page.screenshot({path:'output/desktop/123-failure.png'});}catch{}throw error;}
finally{await app?.close().catch(()=>{});mock.closeAllConnections();await new Promise(r=>mock.close(r));}
