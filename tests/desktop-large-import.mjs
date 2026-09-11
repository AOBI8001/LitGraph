import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {emptyProject} from '../src/startup-project.js';

// Synthetic data only. Never load a user's profile or call a real model.
const root=process.cwd();await mkdir('output/desktop',{recursive:true});
const dataDir=await mkdtemp(path.join(root,'output/desktop/large-import-'));
const project=emptyProject('large-import-fixture');
project.theories.push({id:'complete',label:'已分析测试',labelEn:'Analyzed fixture',color:'#297270'});
project.nodes=Array.from({length:1519},(_,i)=>({id:'fixture-'+i,title:'Synthetic paper '+i,authors:['Fixture author'],year:2020,citations:0,keywords:[],secondaryTheories:[],summary:'Synthetic saved content. '.repeat(200),primaryTheory:i<279?'complete':'unclassified',analysisStatus:i<279?'done':'pending',fulltextStatus:i<1309?'indexed':'downloaded',markdownRelativePath:i<1309?'data/markdown/fixture-'+i+'.md':'',hasPdf:true}));
const job={id:'large-job',projectId:project.meta.id,kind:'local',query:'Synthetic import',filters:{source:'open'},createdAt:new Date().toISOString(),status:'paused',found:1519,items:project.nodes.map((n,i)=>({nodeId:n.id,title:n.title,downloaded:true,converted:i<1309,analyzed:i<279,stage:i<279?'done':'paused'}))};
const library={[project.meta.id]:{id:project.meta.id,title:'Large import fixture',data:project}};
const serialized=JSON.stringify(library);assert.ok(serialized.length>5*1024*1024);
await writeFile(path.join(dataDir,'workspace-state.json'),JSON.stringify({'litgraph.projects.v1':serialized,'litgraph.activeProjectId':project.meta.id,'litgraph.discoveryHistory.v1':JSON.stringify([job]),'litgraph.chat.v2.fixture':'Keep this conversation'}));
const env={...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataDir};delete env.ELECTRON_RUN_AS_NODE;
const options={executablePath:process.env.LITGRAPH_TEST_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.LITGRAPH_TEST_EXECUTABLE?[]:[root],env,timeout:60000};
let app;const errors=[];
const read=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('litgraph.projects.v1'))['large-import-fixture'].data);
try{
 app=await electron.launch(options);let page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));
 await page.locator('#node-count').waitFor({timeout:60000});
 assert.equal((await read(page)).nodes.length,1519);
 await page.locator('#add-papers-button').click();await page.locator('#paper-import-history-toggle').click();
 const redraw=page.locator('[data-history-redraw="large-job"]');await redraw.waitFor();
 assert.equal(await page.locator('.history-paper-row').count(),0,'Collapsed history must not build 1519 invisible detail rows');
 const actions=await redraw.evaluate(button=>[...button.parentElement.children].map(el=>el.textContent));
 assert.deepEqual(actions,['删除该记录','继续','重新绘制画布','展开']);
 await redraw.click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('litgraph.projects.v1'))['large-import-fixture'].data.nodes.filter(n=>n.importCanvasHidden).length===1240,null,{timeout:60000});
 assert.equal((await read(page)).nodes.filter(n=>!n.importCanvasHidden).length,279);
 assert.equal(await page.locator('#node-count').textContent(),'279');
 await page.screenshot({path:'output/desktop/large-import-redraw.png'});
 await page.locator('#window-close').click();await app.close().catch(()=>{});
 let disk=JSON.parse(await readFile(path.join(dataDir,'workspace-state.json'),'utf8'));
 assert.equal(JSON.parse(disk['litgraph.projects.v1'])[project.meta.id].data.nodes.length,1519);
 assert.equal(disk['litgraph.chat.v2.fixture'],'Keep this conversation');
 app=await electron.launch(options);page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));
 await page.locator('#node-count').waitFor({timeout:60000});
 assert.equal((await read(page)).nodes.filter(n=>!n.importCanvasHidden).length,279);
 await page.locator('#add-papers-button').click();await page.locator('#paper-import-history-toggle').click();
 // Hold reconciliation before any model/network work. Continue must restore
 // hidden nodes immediately; pausing must keep all durable source records.
 let heldRoute;await page.route('**/__litgraph/document-state',route=>{heldRoute=route;});
 await page.locator('[data-history-resume="large-job"]').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('litgraph.projects.v1'))['large-import-fixture'].data.nodes.every(n=>!n.importCanvasHidden));
 assert.equal(await page.locator('#node-count').textContent(),'1519');
 await page.locator('[data-history-resume="large-job"]').click();
 if(heldRoute)await heldRoute.abort().catch(()=>{});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('litgraph.discoveryHistory.v1'))[0].status==='paused');
 await page.locator('#window-close').click();await app.close().catch(()=>{});
 disk=JSON.parse(await readFile(path.join(dataDir,'workspace-state.json'),'utf8'));
 const restored=JSON.parse(disk['litgraph.projects.v1'])[project.meta.id].data;
 assert.equal(restored.nodes.length,1519);assert.ok(restored.nodes.every(n=>!n.importCanvasHidden));
 assert.equal(restored.nodes.filter(n=>n.analysisStatus==='done').length,279);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,dataDir,nodes:1519,characters:serialized.length,analyzed:279,restoredAfterContinue:1519,tests:['quota-independent startup','redraw retains records','close/restart','continue restores gray nodes','pause keeps completed stages']}));
}catch(error){console.error(JSON.stringify({dataDir,errors}));throw error;}
finally{await app?.close().catch(()=>{});}
