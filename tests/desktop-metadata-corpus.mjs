import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
// Opt-in real-file audit. PDFs and expected labels are supplied by the operator;
// private sources, application profiles and API credentials are never fixtures.
const folder=path.resolve(process.argv[2]||'');
assert.ok(process.argv[2],'Usage: node tests/desktop-metadata-corpus.mjs <PDF directory> [expected.json]');
const names=(await readdir(folder)).filter(name=>/\.pdf$/i.test(name)).sort();assert.ok(names.length,'No PDFs found');
const files=names.map(name=>path.join(folder,name));
const expected=process.argv[3]?JSON.parse(await readFile(path.resolve(process.argv[3]),'utf8')):null;
await mkdir('output/desktop',{recursive:true});const dataDir=await mkdtemp(path.join(process.cwd(),'output/desktop/metadata-corpus-'));
const env={...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataDir};delete env.ELECTRON_RUN_AS_NODE;
const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let app;const errors=[];const started=Date.now();
try{
 const executablePath=process.env.LITGRAPH_TEST_EXECUTABLE||path.join(process.cwd(),'node_modules/electron/dist/electron.exe');
 app=await electron.launch({executablePath,args:process.env.LITGRAPH_TEST_EXECUTABLE?[]:[process.cwd()],env,timeout:60000});
 const page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.locator('#empty-sample-project').waitFor();
 if(process.env.LITGRAPH_METADATA_ONLINE!=='1')await page.route('**/__litgraph/metadata',route=>route.fulfill({json:{metadata:null}}));
 await page.locator('#add-papers-button').click();await page.locator('#document-input').setInputFiles(files);await page.locator('#start-paper-import').click();
 await page.waitForFunction(count=>JSON.parse(localStorage.getItem('litgraph.discoveryHistory.v1')||'[]').some(job=>job.items.length===count&&job.status!=='running'),files.length,{timeout:480000});
 const project=await page.evaluate(()=>JSON.parse(localStorage.getItem('litgraph.projects.v1'))[localStorage.getItem('litgraph.activeProjectId')].data);
 assert.equal(project.nodes.length,files.length);const results=[];
 for(const node of project.nodes){
  assert.ok(node.originalRelativePath,`Original lost: ${node.fileName}`);
  const retained=await readFile(path.join(dataDir,node.originalRelativePath));assert.equal(hash(retained),hash(await readFile(path.join(folder,node.fileName))),`PDF changed: ${node.fileName}`);
  const labels=expected?.[node.fileName];const authors=[...(node.authors||[])].map(normalize).sort();
  const matches=labels?{title:(labels.titles||[labels.title]).some(title=>normalize(title)===normalize(node.title)),
   authors:(labels.authorSets||[labels.authors]).some(set=>JSON.stringify(set.map(normalize).sort())===JSON.stringify(authors)),
   year:(labels.years||[labels.year]).includes(node.year)}:null;
  results.push({file:node.fileName,title:node.title,authors:node.authors,year:node.year,doi:node.doi,missing:node.sourceMetadataState?.missing,
   converted:Boolean(node.markdownRelativePath),analysisStatus:node.analysisStatus,error:node.processingError,matches});
 }
 assert.deepEqual(errors,[]);
 const report={dataDir,onlineScholarlyMetadata:process.env.LITGRAPH_METADATA_ONLINE==='1',count:files.length,elapsedMs:Date.now()-started,
  bibliographicFieldsComplete:results.filter(r=>r.missing?.length===0).length,converted:results.filter(r=>r.converted).length,
  verifiedAgainstLabels:expected?results.filter(r=>Object.values(r.matches).every(Boolean)).length:null,results};
 await writeFile(path.join(dataDir,'metadata-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await app?.close().catch(()=>{});}
