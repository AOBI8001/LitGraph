import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
// Optional real-file regression harness. Paths are supplied at run time; no
// third-party PDFs or user account configuration are committed or published.
const files=process.argv.slice(2);assert.ok(files.length,'Pass readable PDF fixtures');
const root=process.cwd();await mkdir('output/desktop',{recursive:true});
const dataDir=await mkdtemp(path.join(root,'output/desktop/pdf-conversion-'));
const env={...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataDir};delete env.ELECTRON_RUN_AS_NODE;
let app;const errors=[],results=[];
try{
 app=await electron.launch({executablePath:process.env.LITGRAPH_TEST_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.LITGRAPH_TEST_EXECUTABLE?[]:[root],env,timeout:60000});
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 await page.locator('#empty-sample-project').waitFor();
 await page.route('**/__litgraph/metadata',route=>route.fulfill({json:{metadata:null}}));
 await page.locator('#add-papers-button').click();
 await page.locator('#document-input').setInputFiles(files.map(file=>path.resolve(file)));
 await page.locator('#start-paper-import').click();
 await page.waitForFunction(count=>{const jobs=JSON.parse(localStorage.getItem('litgraph.discoveryHistory.v1')||'[]');return jobs.some(j=>j.items.length===count&&j.status!=='running');},files.length,{timeout:180000});
 const project=await page.evaluate(()=>{const id=localStorage.getItem('litgraph.activeProjectId');return JSON.parse(localStorage.getItem('litgraph.projects.v1'))[id].data;});
 assert.equal(project.nodes.length,files.length);
 for(const node of project.nodes){assert.ok(node.markdownRelativePath,'PDF failed to convert');const markdown=await readFile(path.join(dataDir,node.markdownRelativePath),'utf8');assert.ok(markdown.length>1000);assert.ok(node.originalRelativePath);results.push({characters:markdown.length,converted:true});}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,dataDir,results,noModelCalled:true}));
}finally{await app?.close().catch(()=>{});}
