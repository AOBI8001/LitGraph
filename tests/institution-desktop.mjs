import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
const root=process.cwd();await mkdir('output/desktop',{recursive:true});
const dataRoot=await mkdtemp(path.join(root,'output/desktop/institution-'));
const stream='BT /F1 12 Tf 50 700 Td (Institution fixture: The study reports a reliable source finding and discusses methodological limitations.) Tj ET';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
let pdf='%PDF-1.4\n',offsets=[];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
let pdfGets=0;
const requests=new Map();
const fixture=http.createServer(async(req,res)=>{
  requests.set(req.url,(requests.get(req.url)||0)+1);
  const signed=/institution=fixture/.test(req.headers.cookie||'');
  if(req.url==='/login'&&req.method==='POST'){for await(const _ of req){}res.writeHead(302,{'Set-Cookie':'institution=fixture; HttpOnly; SameSite=Lax; Path=/','Location':'/paper'});return res.end();}
  if(req.url==='/paper.pdf'){pdfGets++;if(!signed){res.writeHead(403);return res.end('Sign in first');}res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="institution-fixture.pdf"'});return res.end(pdf);}
  if(req.url==='/truncated.pdf'){res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="truncated-fixture.pdf"'});return res.end(pdf.slice(0,-12));}
  if(req.url==='/denied'){res.writeHead(403);return res.end('No subscription');}
  if(req.url==='/publisher-block'){res.writeHead(403);return res.end('<h1>There was a problem providing the content you requested</h1><p>CPE00001</p>');}
  if(req.url==='/missing.pdf'){res.writeHead(404);return res.end('Moved');}
  if(req.url==='/science/article/pii/S1111111111111111/pdfft'){res.writeHead(404);return res.end('Use the article download control');}
  if(req.url==='/inline-pdf'&&signed){res.writeHead(200,{'Content-Type':'application/pdf'});return res.end(pdf);}
  if(req.url==='/doi'){res.writeHead(302,{'Location':'/paper'});return res.end();}
  if(req.url==='/science/article/pii/S2222222222222222'){res.writeHead(302,{'Location':'/science/article/pii/S3333333333333333'});return res.end();}
  if(req.url==='/slow')return;
  if(req.url==='/streamed-paper'){
    res.writeHead(200,{'Content-Type':'text/html'});
    res.write('<html><head><meta name="citation_doi" content="10.1000/stream"><meta name="citation_pdf_url" content="/inline-pdf"><title>Streamed paper</title><script src="/slow"></script>');
    return;
  }
  if(req.url.startsWith('/search?')){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<title>Search results</title><article><h3><a href="/science/article/pii/fixture">Exact Full Paper Title With Original Punctuation: A Study</a></h3><span>2024</span></article>');}
  if(req.url==='/browser-check'){
    if(/browser_checked=yes/.test(req.headers.cookie||'')){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<title>Verified paper</title><meta name="citation_pdf_url" content="/paper.pdf">');}
    res.writeHead(403,{'Content-Type':'text/html'});return res.end('<title>Just a moment...</title><div id="challenge-running">Checking browser</div><script>setTimeout(()=>{document.cookie="browser_checked=yes; Path=/";location.reload()},350)</script>');
  }
  if(req.url==='/interactive-check'){res.writeHead(403,{'Content-Type':'text/html'});return res.end('<title>Verification</title><div class="cf-turnstile">Human confirmation required</div><button onclick="location.href=\'/paper\'">Continue</button>');}
  res.writeHead(200,{'Content-Type':'text/html'});
  if(req.url==='/captured-response'&&signed)return res.end('<title>Paper</title><meta name="citation_pdf_url" content="/inline-pdf"><script>fetch("/inline-pdf").then(r=>r.arrayBuffer()).then(()=>document.body.dataset.loaded="yes")</script>');
  if(req.url==='/wrong-early-response'&&signed)return res.end('<meta name="citation_doi" content="10.1000/wrong"><script>fetch("/inline-pdf").then(r=>r.arrayBuffer())</script>');
  if(req.url==='/unrelated-prefetch'&&signed)return res.end('<title>Paper</title><script>fetch("/inline-pdf").then(r=>r.arrayBuffer())</script>');
  if(req.url==='/science/article/pii/S3333333333333333'&&signed)return res.end('<title>Wrong redirected article</title><meta name="citation_pdf_url" content="/paper.pdf">');
  if(req.url==='/button-pdf'&&signed)return res.end('<title>Paper</title><button onclick="location.href=\'/paper.pdf\'">Download PDF</button>');
  if(req.url==='/science/article/pii/S1111111111111111'&&signed)return res.end('<title>Publisher article</title><meta name="citation_doi" content="10.1016/fixture"><button onclick="window.open(\'/paper.pdf\',\'publisher-download\')">Download PDF</button>');
  if(req.url==='/blob-pdf'&&signed)return res.end('<title>Paper</title><button onclick="fetch(\'/inline-pdf\').then(r=>r.blob()).then(b=>{const a=document.createElement(\'a\');a.href=window.URL.createObjectURL(b);a.download=\'article.pdf\';a.click()})">Download PDF</button>');
  if(req.url==='/wrong-paper'&&signed)return res.end('<meta name="citation_doi" content="10.1000/wrong"><button onclick="location.href=\'/paper.pdf\'">Download PDF</button>');
  if(req.url==='/alternatives'&&signed)return res.end('<title>Alternative PDF links</title><meta name="citation_pdf_url" content="/missing.pdf"><meta name="citation_pdf_url" content="/paper.pdf">');
  if(req.url==='/anchor-only'&&signed)return res.end('<title>Authorized paper</title><a href="/paper.pdf">Download <span>PDF</span></a>');
  if(req.url==='/dynamic'&&signed)return res.end('<title>Dynamic authorized paper</title><script>setTimeout(()=>{const meta=document.createElement("meta");meta.name="citation_pdf_url";meta.content="/paper.pdf";document.head.append(meta)},180)</script>');
  if(req.url==='/hidden-login'&&signed)return res.end('<title>Accessible paper</title><div hidden><input type="password"><div class="g-recaptcha"></div><div class="cf-turnstile"></div></div><meta name="citation_pdf_url" content="/paper.pdf">');
  if(req.url==='/popup-pdf'&&signed)return res.end('<title>Paper</title><button onclick="window.open(\'/paper.pdf\',\'article-download\')">Download PDF</button>');
  if(req.url==='/embedded-pdf'&&signed)return res.end('<title>Paper viewer</title><object type="application/pdf" data="/paper.pdf"></object>');
  if(req.url==='/popup-check'&&signed)return res.end('<title>Paper</title><button onclick="window.open(\'/interactive-check\',\'verification-popup\')">Download PDF</button>');
  if(req.url==='/paper'&&signed)return res.end('<title>Authorized paper</title><meta name="citation_pdf_url" content="/paper.pdf"><h1>Authorized paper</h1><a href="/paper.pdf">Download PDF</a><a href="/popup" target="institution-auth">Open authentication popup</a>');
  if(req.url==='/popup')return res.end('<title>Authentication popup</title><h1>Authentication popup</h1><p>Same session: '+signed+'</p><form action="/search"><input type="search" name="qs"><button>Search</button></form>');
  return res.end('<title>Institution fixture</title><h1>Institution fixture</h1><form action="/login" method="post"><label>Institution account<input name="account"></label><button>Sign in</button></form>');
});
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${fixture.address().port}`;
const packaged=Boolean(process.env.LITGRAPH_TEST_EXECUTABLE);
const options={executablePath:process.env.LITGRAPH_TEST_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe'),args:packaged?[]:[root],env:{...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataRoot},timeout:45000};delete options.env.ELECTRON_RUN_AS_NODE;
let app;
try{
 app=await electron.launch(options);let page=await app.firstWindow();await page.locator('#empty-model-access').waitFor();
 await page.locator('[data-panel="literature-discovery"]').click();
 await page.locator('[data-discovery-value="institution"]').click();
 assert.equal(await page.locator('#discovery-institution-url').inputValue(),'');
 assert.equal(await page.locator('.institution-browser-setup').count(),0);
 await page.locator('#discovery-institution-url').fill(url);
 const ready=app.waitForEvent('window');await page.locator('#discovery-institution-form button[type="submit"]').click();
 let chrome=await ready;await chrome.waitForLoadState();
 const remote=()=>app.evaluate(({BrowserWindow},url)=>{const windows=BrowserWindow.getAllWindows().filter(w=>w.isVisible()&&w.webContents.getURL().endsWith('/institution.html'));const w=windows.find(w=>w.isFocused())||windows.at(-1);return w?.contentView.children.find(c=>c.webContents?.getURL().startsWith(url))?.webContents.id;},url);
 let remoteId;
 for(let i=0;i<30&&!remoteId;i++){remoteId=await remote();await new Promise(r=>setTimeout(r,100));}
 assert.ok(remoteId);
 assert.equal(await chrome.locator('#message').innerText(),'');
 assert.equal(await app.evaluate(async({webContents},id)=>webContents.fromId(id).executeJavaScript('typeof window.litgraphDesktop+":"+typeof require'),remoteId),'undefined:undefined');
 await app.evaluate(async({webContents},id)=>webContents.fromId(id).executeJavaScript('document.querySelector("form").requestSubmit()'),remoteId);
 await chrome.waitForFunction(()=>document.querySelector('#address').value.endsWith('/paper'));
 const popupReady=app.waitForEvent('window').catch(async error=>{console.log(await app.evaluate(({BrowserWindow,webContents})=>({windows:BrowserWindow.getAllWindows().map(w=>w.webContents.getURL()),contents:webContents.getAllWebContents().map(c=>({id:c.id,url:c.getURL()}))})));throw error;});
 await app.evaluate(({webContents},id)=>{setTimeout(()=>webContents.fromId(id).executeJavaScript('document.querySelector("a[target]").click()'),0);},remoteId);
 let popup=await popupReady;await new Promise(r=>setTimeout(r,500));popup=app.windows().find(p=>p!==chrome&&p.url().endsWith('/institution.html'))||popup;await popup.waitForFunction(()=>document.querySelector('#address')?.value.endsWith('/popup'));
 assert.equal(await popup.locator('[data-action="save-close"]').count(),1);
 assert.equal(await popup.locator('[data-action="clear-cookies"]').count(),1);
 assert.equal(await popup.locator('[data-action="logout"]').count(),1);
 const popupRemote=await app.evaluate(({webContents},url)=>webContents.getAllWebContents().find(c=>c.getURL()===url+'/popup').id,url);
 assert.equal(await app.evaluate(async({webContents},id)=>webContents.fromId(id).executeJavaScript('typeof window.institutionControls+":"+typeof require'),popupRemote),'undefined:undefined');
 await app.evaluate(async({webContents},id)=>webContents.fromId(id).executeJavaScript('localStorage.setItem("saved-popup","yes");sessionStorage.setItem("live-session","retained");window.liveAuthState=42;document.cookie="popup=yes; Path=/"'),popupRemote);
 await popup.locator('[data-action="save-close"]').click();await new Promise(r=>setTimeout(r,300));
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().endsWith('/institution.html')).some(w=>w.isVisible())),false);
 assert.equal((await page.evaluate(()=>window.litgraphDesktop.institution('saved'))).url,url+'/popup');
 const restoredWindow=popup;
 await page.evaluate(url=>window.litgraphDesktop.institution('open',{portalUrl:url,useSaved:true,language:'en'}),url);chrome=restoredWindow;
 await chrome.waitForFunction(()=>document.querySelector('#address').value.endsWith('/popup'));
 remoteId=await remote();
 assert.equal(await app.evaluate(async({webContents},id)=>webContents.fromId(id).executeJavaScript('localStorage.getItem("saved-popup")'),remoteId),'yes');
 assert.equal(remoteId,popupRemote);
 assert.equal(await app.evaluate(async({webContents},id)=>webContents.fromId(id).executeJavaScript('sessionStorage.getItem("live-session")+":"+window.liveAuthState'),remoteId),'retained:42');
 const searched=await page.evaluate(url=>window.litgraphDesktop.institution('search',{portalUrl:url,originalQuery:'Exact Full Paper Title With Original Punctuation: A Study',filters:{resultCount:5},language:'en'}),url);
 assert.equal(searched.papers[0].title,'Exact Full Paper Title With Original Punctuation: A Study');
 assert.equal(searched.query,'Exact Full Paper Title With Original Punctuation: A Study');
 assert.ok([...requests.keys()].some(p=>p.startsWith('/search?qs=Exact')));
 console.log('Popup controls, shared storage, saved final page and actual institution search passed');
 console.log('Login saved; default URL and extension removal verified');
 await page.evaluate(url=>window.litgraphDesktop.institution('open',{portalUrl:url,url:url+'/paper',language:'en'}),url);
 await chrome.waitForFunction(()=>document.querySelector('#address').value.endsWith('/paper'));
 await chrome.locator('[data-action="save-close"]').click();
 const samePageRequests=requests.get('/paper');
 const acquire=(endpoint,extra={})=>page.evaluate(({url,endpoint,extra})=>window.litgraphDesktop.institution('acquire',{portalUrl:url,url:url+endpoint,language:'en',...extra}),{url,endpoint,extra});
 assert.equal(Buffer.from((await acquire('/paper')).data,'base64').toString(),pdf);
 assert.equal(requests.get('/paper'),samePageRequests,'Reuse the existing article without an extra navigation');
 for(const endpoint of ['/doi','/alternatives','/anchor-only','/dynamic','/captured-response','/button-pdf','/blob-pdf','/hidden-login','/popup-pdf','/embedded-pdf','/inline-pdf']){
   const result=await acquire(endpoint);
   assert.equal(Buffer.from(result.data,'base64').toString(),pdf,endpoint);
   console.log('Authenticated automatic PDF: '+endpoint);
 }
 assert.equal(requests.get('/missing.pdf'),1);
 assert.equal(Buffer.from((await acquire('/streamed-paper',{doi:'10.1000/stream',timeoutMs:8000})).data,'base64').toString(),pdf,'Verified streamed metadata is usable before a stalled publisher script finishes');
 const routedFallback=await acquire('/science/article/pii/S1111111111111111',{doi:'10.1016/fixture'});
 assert.equal(Buffer.from(routedFallback.data,'base64').toString(),pdf);
 assert.equal(requests.get('/science/article/pii/S1111111111111111/pdfft'),1);
 assert.equal(requests.get('/science/article/pii/S1111111111111111'),2,'Return to the real article after the publisher route fails');
 console.log('Publisher route failure falls back to the original article PDF button');
 const repeatedPopup=await acquire('/popup-pdf',{nodeId:'second-popup-paper'});
 assert.equal(Buffer.from(repeatedPopup.data,'base64').toString(),pdf,'A repeated named popup remains owned by its new task');
 assert.equal((await page.evaluate(()=>window.litgraphDesktop.institution('list'))).length,0,'Automatic popup PDF is not duplicated as a manual receipt');
 await assert.rejects(acquire('/publisher-block'),/page blocked; skipped/);
 await assert.rejects(acquire('/interactive-check',{verificationTimeoutMs:120}),/verification timed out; skipped/);
 assert.equal(Buffer.from((await acquire('/paper.pdf')).data,'base64').toString(),pdf,'Timeout skips one item and releases the next download');
 requests.delete('/interactive-check');
 await assert.rejects(acquire('/wrong-paper',{doi:'10.1000/expected'}),/DOI does not match/);
 await assert.rejects(acquire('/wrong-early-response',{doi:'10.1000/expected'}),/DOI does not match/);
 await assert.rejects(acquire('/unrelated-prefetch',{doi:'10.1000/expected'}),/No usable/);
 await assert.rejects(acquire('/science/article/pii/S2222222222222222'),/article identity does not match/);
 await assert.rejects(acquire('/denied'),/No usable/);
 await assert.rejects(acquire('/truncated.pdf'),/incomplete|No usable|ERR_ABORTED/);
 // Simulated challenge only: no real CAPTCHA is solved by this test.
 await page.evaluate(url=>{
   window.pendingAcquisition=window.litgraphDesktop.institution('acquire',{portalUrl:url,url:url+'/interactive-check',taskId:'challenge',timeoutMs:1200,language:'en'}).then(r=>{window.challengeResult=r;},e=>{window.challengeError=e.message;});
 },url);
 chrome=app.windows().find(p=>p.url().endsWith('/institution.html'));
 await chrome.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Waiting for authentication'));
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().endsWith('/institution.html')&&w.isVisible())),true);
 const beforePDF=pdfGets;
 await page.evaluate(url=>{window.nextAcquisition=window.litgraphDesktop.institution('acquire',{portalUrl:url,url:url+'/anchor-only',taskId:'next'}).then(r=>window.nextResult=r,e=>window.nextError=e.message);},url);
 await new Promise(r=>setTimeout(r,1500));assert.equal(pdfGets,beforePDF);
 assert.equal(requests.get('/interactive-check'),1);
 await chrome.locator('[data-action="save-close"]').click();
 await chrome.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Authentication is still required'));
 await new Promise(r=>setTimeout(r,500));assert.equal(pdfGets,beforePDF);
 await chrome.screenshot({path:path.join(dataRoot,'verification-wait.png')});
 remoteId=await remote();
 assert.equal(await app.evaluate(({webContents},id)=>webContents.fromId(id).debugger.isAttached(),remoteId),false,'Human handoff has no attached debugger');
 // A blank redirect must not be accepted as successful authentication.
 await app.evaluate(async({webContents},id)=>webContents.fromId(id).executeJavaScript('document.title="";document.body.innerHTML=""'),remoteId);
 await chrome.locator('[data-action="save-close"]').click();
 assert.equal(await chrome.locator('#message').innerText(),'Authentication is still required; the download queue remains paused.');
 assert.equal(pdfGets,beforePDF);
 // Restore only the local fixture, then exercise a second verification cycle.
 await app.evaluate(async({webContents},{id,url})=>webContents.fromId(id).loadURL(url+'/interactive-check'),{id:remoteId,url});
 assert.equal(await app.evaluate(({webContents},id)=>webContents.fromId(id).debugger.isAttached(),remoteId),false);
 // This click is on the local test fixture's ordinary Continue button.
 await app.evaluate(async({webContents},id)=>webContents.fromId(id).executeJavaScript('document.querySelector("button").click()'),remoteId);
 await chrome.waitForFunction(()=>document.querySelector('#address').value.endsWith('/paper'));
 await chrome.locator('[data-action="save-close"]').click();
 await page.waitForFunction(()=>window.challengeResult&&window.nextResult,null,{timeout:20000});
 assert.equal(await page.evaluate(()=>window.challengeError||window.nextError),undefined);
 console.log('Verification: foreground, same page, no next request, manual resume and queue continuation');
 await page.evaluate(url=>{window.popupRequest=window.litgraphDesktop.institution('acquire',{portalUrl:url,url:url+'/popup-check',taskId:'popup-verification',language:'en'}).then(r=>window.popupResult=r,e=>window.popupError=e.message);},url);
 let verificationPopup;
 for(let i=0;i<60&&!verificationPopup;i++){
   for(const p of app.windows().filter(p=>p.url().endsWith('/institution.html'))){
     if((await p.locator('#address').inputValue()).endsWith('/interactive-check')&&(await p.locator('#message').innerText()).startsWith('Waiting for authentication'))verificationPopup=p;
   }
   if(!verificationPopup)await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(verificationPopup,'The challenge popup gets its own controls and task wait');
 const waitingRemote=await remote();
 assert.equal(await app.evaluate(({webContents},id)=>webContents.fromId(id).getURL(),waitingRemote),url+'/interactive-check');
 assert.equal(await app.evaluate(({webContents},id)=>webContents.fromId(id).debugger.isAttached(),waitingRemote),false,'Popup handoff releases its debugger too');
 const beforePopupResume=pdfGets;await new Promise(r=>setTimeout(r,500));assert.equal(pdfGets,beforePopupResume);
 await app.evaluate(async({webContents},id)=>webContents.fromId(id).executeJavaScript('document.querySelector("button").click()'),waitingRemote);
 await verificationPopup.waitForFunction(()=>document.querySelector('#address').value.endsWith('/paper'));
 await verificationPopup.locator('[data-action="save-close"]').click();
 await page.waitForFunction(()=>window.popupResult||window.popupError,null,{timeout:20000});
 assert.equal(await page.evaluate(()=>window.popupError),undefined);
 assert.equal((await page.evaluate(()=>window.litgraphDesktop.institution('list'))).length,0);
 console.log('Authentication popup: exact window foreground, manual resume, original task receives PDF');

 await page.evaluate(url=>{window.cancelledRequest=window.litgraphDesktop.institution('acquire',{portalUrl:url,url:url+'/interactive-check',taskId:'cancel-wait',language:'en'}).catch(e=>window.cancelledError=e.message);},url);
 await chrome.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Waiting for authentication'));
 await page.evaluate(()=>window.litgraphDesktop.institution('cancel',{id:'cancel-wait'}));
 await page.waitForFunction(()=>window.cancelledError);
 await assert.rejects(acquire('/slow',{timeoutMs:350}),/timed out/);
 await assert.rejects(page.evaluate(()=>window.litgraphDesktop.institution('open',{portalUrl:'file:///C:/Windows/win.ini'})));
 await app.close();app=await electron.launch(options);page=await app.firstWindow();await page.locator('#project-selector-label').waitFor();
 assert.equal((await page.evaluate(()=>window.litgraphDesktop.institution('saved'))).url,url+'/paper');
 const restored=await acquire('/paper.pdf');assert.equal(Buffer.from(restored.data,'base64').toString(),pdf);
 console.log('Session survives application restart');
 chrome=app.windows().find(p=>p.url().endsWith('/institution.html'));
 await page.evaluate(url=>window.litgraphDesktop.institution('open',{portalUrl:url,url:url+'/paper',projectId:localStorage.getItem('litgraph.activeProjectId'),language:'en'}),url);
 remoteId=await remote();
 page.on('dialog',d=>d.accept());
 await app.evaluate(async({webContents},id)=>webContents.fromId(id).executeJavaScript('document.querySelector("a").click()'),remoteId);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('litgraph.discoveryHistory.v1')||'[]').some(j=>j.kind==='institution'&&j.items.some(i=>i.converted)),null,{timeout:45000});
 console.log('Manual PDF receipt and bundled Markdown conversion passed');
 await chrome.locator('[data-action="clear-cookies"]').click();
 await chrome.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Cookies cleared.'));
 assert.equal(await app.evaluate(async({session})=>(await session.fromPartition('persist:litgraph-institution').cookies.get({})).length),0);
 console.log(JSON.stringify({passed:true,packaged,dataRoot}));
}finally{await app?.close().catch(()=>{});fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve));}
