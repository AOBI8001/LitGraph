// Optional network check against one openly licensed publisher article.
// Uses a fresh desktop profile, never an installed user's cookies or API key.
import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {isCompletePdf} from '../scripts/acquisition-core.js';

const root=process.cwd();
await mkdir('output/desktop',{recursive:true});
const dataRoot=await mkdtemp(path.join(root,'output/desktop/public-institution-'));
const executablePath=process.env.LITGRAPH_TEST_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe');
const env={...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataRoot};
delete env.ELECTRON_RUN_AS_NODE;
let app;
try{
  app=await electron.launch({executablePath,args:process.env.LITGRAPH_TEST_EXECUTABLE?[]:[root],env,timeout:45000});
  const page=await app.firstWindow();await page.locator('#empty-model-access').waitFor();
  await app.evaluate(({app})=>{globalThis.publicTrace=[];app.on('web-contents-created',(_event,c)=>{
    for(const event of ['did-start-navigation','dom-ready','did-finish-load','did-fail-load'])c.on(event,(_event,...args)=>{globalThis.publicTrace.push({event,url:c.getURL(),args:args.slice(0,2)});});
  });});
  const started=Date.now();
  await page.evaluate(()=>{
    window.liveDownload=window.litgraphDesktop.institution('acquire',{
      portalUrl:'https://journals.plos.org/',
      url:'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0000308',
      doi:'10.1371/journal.pone.0000308',taskId:'public-live',language:'en'
    }).then(value=>window.liveResult=value,error=>window.liveError=error.message);
  });
  try{await page.waitForFunction(()=>window.liveResult||window.liveError,null,{timeout:45000});}
  catch{
    const waiting=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.isVisible()&&w.webContents.getURL().endsWith('/institution.html')).length>0);
    await page.evaluate(()=>window.litgraphDesktop.institution('cancel',{id:'public-live'}));
    throw Error(waiting?'Live publisher requires human authentication; no verification was automated.':'Live publisher did not complete within the test deadline.');
  }
  const {result,error}=await page.evaluate(()=>({result:window.liveResult,error:window.liveError}));
  if(error)console.log(await app.evaluate(async({BrowserWindow})=>Promise.all(BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().endsWith('/institution.html')).map(async w=>{
    const c=w.contentView.children.find(v=>v.webContents)?.webContents;
    return c?c.executeJavaScript('({url:location.href,title:document.title,doi:[...document.querySelectorAll("meta")].filter(e=>/doi|identifier/i.test(e.outerHTML)).map(e=>e.outerHTML),pdf:[...document.querySelectorAll("meta, a")].filter(e=>/pdf|printable/i.test(e.outerHTML)).slice(0,15).map(e=>e.outerHTML)})').catch(e=>({error:e.message})):{};
  }))));
  if(error)console.log(await app.evaluate(()=>globalThis.publicTrace));
  assert.ok(result,error);
  const bytes=Buffer.from(result.data,'base64');assert.ok(isCompletePdf(bytes));
  assert.match(result.sourceUrl,/journals\.plos\.org/);
  console.log(JSON.stringify({passed:true,publisher:'PLOS',doi:'10.1371/journal.pone.0000308',bytes:bytes.length,seconds:Math.round((Date.now()-started)/1000),dataRoot}));
}finally{await app?.close().catch(()=>{});}
