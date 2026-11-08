import { _electron as electron } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { emptyProject } from '../src/startup-project.js';
const root=process.cwd();await mkdir('output/desktop',{recursive:true});
const dataDir=await mkdtemp(path.join(root,'output/desktop/metadata-'));
const project=emptyProject('metadata-fixture');project.meta.title='Metadata regression';
const cases=[
 {id:'split',title:'信息判断任务中的研究比较',fileName:'信息判断任务中的研究比较_张三.pdf',text:'信息判断任务中的研究比较\n张三\n● 1\n李四\n2\n测试大学\n2023 年 3 月\n摘要\n测试'},
 {id:'multi',title:'目标研究中的证据比较',fileName:'目标研究中的证据比较_王五.pdf',text:'An unrelated preceding experiment\nJohn Example\nTesting University\nAbstract\nOther article.\n目标研究中的证据比较\n王五   赵六(通讯作者)\n测试大学\n摘要\n目标研究。'},
 {id:'column',title:'合成任务中的判断方法',fileName:'合成任务中的判断方法_张三.pdf',text:'● 品德与心理\n张三   李四\n合成任务中的判断方法\n摘要\n测试'},
 {id:'manual',title:'人工确认的标题',fileName:'原文中的合成研究题目_张三.pdf',authors:['人工确认作者'],year:2020,metadataOverrides:{title:true,authors:true,year:true},text:'原文中的合成研究题目\n张三，李四\n测试大学\n2023 年 3 月\n摘要\n测试'},
 {id:'pending',title:'尚待确认的合成研究',fileName:'尚待确认的合成研究.pdf',text:'尚待确认的合成研究\nAuthors: undecoded\nAbstract\nNo usable byline.'},
];
await mkdir(path.join(dataDir,'data/records'),{recursive:true});
project.nodes=cases.map(({text,...fixture},i)=>{const key=createHash('sha256').update(project.meta.id+':'+fixture.id).digest('hex');return {authors:[],year:2026,importedLocally:true,sourceMetadataVersion:1,metadataChecked:true,metadataWarning:'No exact match',analysisStatus:'done',primaryTheory:'unclassified',secondaryTheories:[],keywords:[],x:i*90,y:0,fulltextKey:key,fulltextStatus:'indexed',...fixture};});
for(let i=0;i<cases.length;i++)await writeFile(path.join(dataDir,'data/records',project.nodes[i].fulltextKey+'.json'),JSON.stringify({key:project.nodes[i].fulltextKey,nodeId:cases[i].id,projectId:project.meta.id,markdown:cases[i].text,sourceKind:'pdf_text'}));
await writeFile(path.join(dataDir,'workspace-state.json'),JSON.stringify({'litgraph.projects.v1':JSON.stringify({[project.meta.id]:{id:project.meta.id,title:project.meta.title,data:project}}),'litgraph.activeProjectId':project.meta.id}));
const env={...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataDir};delete env.ELECTRON_RUN_AS_NODE;
let app;const errors=[],lookups=[];
try{
 app=await electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[root],env,timeout:60000});
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__litgraph/metadata',route=>{lookups.push(route.request().postDataJSON());return route.fulfill({json:{metadata:null}});});
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('litgraph.projects.v1'))['metadata-fixture'].data);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('litgraph.projects.v1'))?.['metadata-fixture']?.data.nodes.every(n=>n.sourceMetadataVersion===2));
 let saved=await state();
 assert.deepEqual(saved.nodes[0].authors,['张三','李四']);assert.equal(saved.nodes[0].year,2023);
 assert.deepEqual(saved.nodes[1].authors,['王五','赵六']);assert.ok(!saved.nodes[1].authors.includes('John Example'));
 assert.deepEqual(saved.nodes[2].authors,['张三','李四']);
 assert.deepEqual(saved.nodes[3].authors,['人工确认作者']);assert.equal(saved.nodes[3].title,'人工确认的标题');assert.equal(saved.nodes[3].year,2020);
 assert.deepEqual(saved.nodes[4].authors,[]);assert.ok(saved.nodes[4].sourceMetadataState.missing.includes('authors'));assert.equal(saved.nodes[4].analysisStatus,'done');
 const projectFile=path.join(dataDir,'data/projects',createHash('sha256').update(project.meta.id).digest('hex')+'.json');
 await page.waitForTimeout(300);let durable=JSON.parse(await readFile(projectFile,'utf8'));assert.deepEqual(durable.nodes[0].authors,['张三','李四']);
 // Search a unique title to open its inspector without relying on canvas pixels.
 await page.locator('#search-input').fill(cases[4].title);await page.locator('#search-input').press('Enter');
 await page.locator('#repair-paper-metadata').waitFor();assert.match(await page.locator('.paper-metadata-status').innerText(),/作者/);
 await page.locator('#repair-paper-metadata').click();await page.locator('#repair-paper-metadata:not([disabled])').waitFor();
 assert.ok((await state()).nodes[4].sourceMetadataState.missing.includes('authors'));
 await page.locator('#language-button').click();assert.match(await page.locator('#repair-paper-metadata').innerText(),/Retry bibliographic extraction/);
 assert.match(await page.locator('.paper-metadata-status').innerText(),/authors/);
 await page.reload();await page.locator('#node-count').waitFor();saved=await state();assert.deepEqual(saved.nodes[0].authors,['张三','李四']);assert.equal(saved.nodes[3].year,2020);
 await page.locator('#search-input').fill('');await page.locator('#search-input').press('Enter');
 await page.locator('#add-papers-button').click();
 await page.locator('#document-input').setInputFiles({name:'opaque-0007.md',mimeType:'text/markdown',buffer:Buffer.from('Fresh synthetic evidence comparison\nAda Fixture, Ben Fixture\nTesting University\nPublished: 2024\nAbstract\nSynthetic import fixture, no private data.')});
 await page.locator('#start-paper-import').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('litgraph.projects.v1'))['metadata-fixture'].data.nodes.some(n=>n.fileName==='opaque-0007.md'&&n.authors?.length===2),null,{timeout:20000});
 const imported=(await state()).nodes.find(n=>n.fileName==='opaque-0007.md');
 assert.equal(imported.title,'Fresh synthetic evidence comparison');assert.deepEqual(imported.authors,['Ada Fixture','Ben Fixture']);
 assert.ok(lookups.some(input=>input.title==='Fresh synthetic evidence comparison'),'new import must match on the real source title');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,dataDir,checks:['v1 migration','split byline','target identity across two articles','column rejection','manual edits preserved','incomplete metadata independent of analysis completion','metadata-only retry','Chinese and English pending UI','workspace and project snapshot agree','reload persistence','fresh MD import with opaque filename']}));
}finally{await app?.close().catch(()=>{});}
