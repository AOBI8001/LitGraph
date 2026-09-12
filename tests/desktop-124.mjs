import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {emptyProject} from '../src/startup-project.js';
const root=process.cwd();await mkdir('output/playwright',{recursive:true});
const dataDir=await mkdtemp(path.join(root,'output/playwright/release124-'));
const project=emptyProject('fixture124');project.meta.title='1.2.4 回归测试';
const key=createHash('sha256').update('fixture124:paper0').digest('hex');
project.nodes=Array.from({length:1500},(_,i)=>({id:'p'+i,title:'Fixture '+i,authors:[],year:2026,primaryTheory:'unclassified',secondaryTheories:[],keywords:[],importCanvasHidden:i>=50,importedLocally:true,...(i===0?{fulltextKey:key,fulltextStatus:'indexed',markdownRelativePath:'data/markdown/'+key+'.md'}:{})}));
const markdown='## PDF Page 1\n测试学位论文\n姓名：张惠芳\n指导教师：尚元东\n答辩日期：2024年5月18日\n## PDF Page 2\n摘要\n这是合成测试资料，不含真实用户数据。';
await mkdir(path.join(dataDir,'data/records'),{recursive:true});await mkdir(path.join(dataDir,'data/markdown'),{recursive:true});
await writeFile(path.join(dataDir,'data/records',key+'.json'),JSON.stringify({key,nodeId:'p0',projectId:'fixture124',markdown,sourceKind:'pdf_text'}));
await writeFile(path.join(dataDir,'data/markdown',key+'.md'),markdown);
await writeFile(path.join(dataDir,'workspace-state.json'),JSON.stringify({'litgraph.projects.v1':JSON.stringify({fixture124:{id:'fixture124',title:project.meta.title,data:project}}),'litgraph.activeProjectId':'fixture124'}));
const env={...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataDir};delete env.ELECTRON_RUN_AS_NODE;
let app;const errors=[];
try{
 app=await electron.launch({executablePath:process.env.LITGRAPH_TEST_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.LITGRAPH_TEST_EXECUTABLE?[]:[root],env,timeout:60000});const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('#node-count').waitFor();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('litgraph.projects.v1')).fixture124.data.nodes[0].year===2024,null,{timeout:20000});
 const repaired=await page.evaluate(()=>JSON.parse(localStorage.getItem('litgraph.projects.v1')).fixture124.data.nodes[0]);assert.deepEqual(repaired.authors,['张惠芳']);
 await page.locator('#project-selector-button').click();assert.match(await page.locator('[data-project-id="fixture124"] i').innerText(),/^50\s/);await page.locator('#project-selector-button').click();
 await page.locator('#research-desk-entry').click();assert.equal(await page.locator('.research-index-status').count(),0);assert.equal(await page.getByRole('button',{name:/继续索引|暂停索引|全文索引/}).count(),0);
 await page.screenshot({path:'output/playwright/124-research.png'});await page.locator('.deep-read-window [data-close]').click();
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('[data-workspace-action="api"]').click();await page.locator('#api-modal').waitFor();assert.equal(await page.locator('.connection-recommended').innerText(),'推荐');
 assert.equal(await page.locator('#connect-agent-runtime').innerText(),'测试并保存');assert.equal(await page.locator('#test-api-button').innerText(),'测试并保存');
 for(const size of [{width:1280,height:800},{width:1600,height:1000}]){
   await page.setViewportSize(size);const boxes=await page.locator('#test-api-button, #connect-agent-runtime').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,width:r.width,height:r.height,bg:s.backgroundColor};}));
   assert.ok(Math.abs(boxes[0].x-boxes[1].x)<1);assert.equal(boxes[0].width,boxes[1].width);assert.equal(boxes[0].height,boxes[1].height);assert.equal(boxes[0].bg,boxes[1].bg);
   assert.ok(await page.locator('#api-form').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
   await page.screenshot({path:`output/playwright/124-model-${size.width}.png`});
 }
 await page.locator('#api-modal [data-close-modal="api"]').first().click();await page.reload();await page.locator('#node-count').waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('litgraph.projects.v1')).fixture124.data.nodes[0].year),2024);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,dataDir,checks:['legacy Chinese metadata repaired and persisted','50 visible of 1500 in project selector','index controls removed','API recommended','aligned identical test/save buttons','responsive model connection layout','no renderer errors']}));
}finally{await app?.close().catch(()=>{});}
