import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {mkdir,mkdtemp} from 'node:fs/promises';

// All login/cookie/verification data in this test belongs to the local fixture.
// The user's installed application and real institution profile are untouched.
const root=process.cwd();await mkdir('output/desktop',{recursive:true});
const dataRoot=await mkdtemp(path.join(root,'output/desktop/institution-search-'));
const title='Online impulsive buying in social commerce: A mixed-methods research';
let pdf='%PDF-1.4\n';const offsets=[];const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];
objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const requests=[];
const card=(name,number=1)=>`<prm-brief-result-container id="SEARCH_RESULT_RECORDID_${number}"><h3><a href="/discovery/fulldisplay?docid=record_${number}CitationCount">${name}</a></h3><div class="authors">Researcher One; Researcher Two</div><span class="year">2024</span></prm-brief-result-container>`;
const html=body=>'<!doctype html><meta charset="utf-8"><title>Institution catalogue</title>'+body;
const page=()=>html(`<form role="search"><input type="search" name="query" aria-label="Search catalogue"><button type="submit">Search</button></form><div id="searchResultsContainer"><p>1 result</p>${card('Old unrelated result that must not leak into the new search')}</div><button id="next" aria-label="Next page" hidden>Next page</button><script>
let page=1;
async function load(){const input=document.querySelector('input');const box=document.querySelector('#searchResultsContainer');const quiet=input.value.startsWith('Quiet');if(!quiet)box.setAttribute('aria-busy','true');else history.replaceState({},'',location.pathname+'?q='+encodeURIComponent(input.value));const response=await fetch('/results?q='+encodeURIComponent(input.value)+'&page='+page);box.innerHTML=await response.text();box.setAttribute('aria-busy','false');document.querySelector('#next').hidden=page!==1||input.value==='empty'||input.value==='unsupported'||quiet;}
document.querySelector('form').onsubmit=e=>{e.preventDefault();page=1;load()};document.querySelector('#next').onclick=()=>{page++;load()};
</script>`);
let secondaryPort;
const fixture=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture');const signed=/institution=fixture/.test(req.headers.cookie||'');
  requests.push({path:url.pathname,query:url.searchParams.get('q'),signed});
  if(url.pathname==='/paper.pdf'){if(!signed){res.writeHead(403);res.end('Not signed in');return;}res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="fixture.pdf"'});res.end(pdf);return;}
  if(url.pathname==='/login'){
    if(req.method==='POST'){for await(const _ of req){}res.writeHead(302,{'Set-Cookie':'institution=fixture; HttpOnly; SameSite=Lax; Path=/','Location':'/catalog'});res.end();return;}
    res.setHeader('Content-Type','text/html');res.end(html('<form method="post"><button>Fixture sign in</button></form>'));return;
  }
  if(url.pathname==='/results'){
    if(!signed){res.writeHead(401);res.end('Sign in required');return;}
    // Existing records stay visible during the actual asynchronous search.
    await new Promise(r=>setTimeout(r,1100));const q=url.searchParams.get('q'),page=Number(url.searchParams.get('page'));
    res.setHeader('Content-Type','text/html');
    res.end(q==='empty'?'<div class="no-results">No results found</div>':q==='unsupported'?'<div class="results-count">10 results</div><div>Records use an unsupported renderer</div>':`<p>${page===1?'2':'2'} results</p>${card(page===1?q:'Open scholarship and library interoperability: A framework',page)}`);return;
  }
  res.setHeader('Content-Type','text/html');
  if(url.pathname==='/discovery/fulldisplay'){res.end(html(`<prm-full-view><h1>${title}</h1><section><h2>Online access</h2><a href="/resolver?article=fixture">Publisher full text collection</a></section></prm-full-view>`));return;}
  if(url.pathname==='/resolver'){res.writeHead(302,{Location:'/publisher/article?record=fixture'});res.end();return;}
  if(url.pathname==='/publisher/article'){res.end(html(`<meta name="citation_title" content="${title}"><meta name="citation_pdf_url" content="/paper.pdf"><h1>${title}</h1>`));return;}
  if(url.pathname==='/catalog'){res.end(page());return;}
  if(url.pathname==='/manual-check'){res.end('<title>Just a moment...</title><div class="cf-turnstile">Local test confirmation</div><button onclick="location.href=\'/catalog\'">Continue</button>');return;}
  if(url.pathname==='/embedded'){res.end(html('<h1>Library portal</h1><iframe src="/catalog" style="width:900px;height:650px"></iframe>'));return;}
  if(url.pathname==='/embedded-wrapper'){res.end(html('<form action="/wrong-site-search"><input type="search" aria-label="Search this website"><button>Search</button></form><iframe title="Advertisement" src="/advert" style="width:500px;height:300px"></iframe><iframe title="Library catalogue" src="/catalog" style="width:900px;height:650px"></iframe>'));return;}
  if(url.pathname==='/embedded-cross'){res.end(html(`<h1>Library portal</h1><iframe title="Library catalogue" src="http://127.0.0.1:${secondaryPort}/catalog" style="width:900px;height:650px"></iframe>`));return;}
  if(url.pathname==='/advert'){res.end(html('<input type="password"><form><input type="search" aria-label="Search"><button>Search</button></form>'));return;}
  if(url.pathname==='/popup-search'){res.end(html('<form action="/popup-results" target="catalog-search"><input type="search" name="q"><button>Search</button></form>'));return;}
  if(url.pathname==='/popup-results'){res.end(html('<div id="searchResultsContainer">'+card(url.searchParams.get('q'))+'</div>'));return;}
  res.end(html('<h1>Unknown page</h1>'));
});
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${fixture.address().port}`;
const secondary=http.createServer((req,res)=>fixture.emit('request',req,res));await new Promise(resolve=>secondary.listen(0,'127.0.0.1',resolve));secondaryPort=secondary.address().port;
const executable=process.env.LITGRAPH_TEST_EXECUTABLE;const options={executablePath:executable||path.join(root,'node_modules/electron/dist/electron.exe'),args:executable?[]:[root],env:{...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataRoot},timeout:45000};delete options.env.ELECTRON_RUN_AS_NODE;
let app;
try{
  app=await electron.launch(options);const main=await app.firstWindow();await main.locator('#empty-model-access').waitFor();
  const open=endpoint=>main.evaluate(({url,endpoint})=>window.litgraphDesktop.institution('open',{portalUrl:url,url:url+endpoint,language:'en'}),{url,endpoint});
  const remote=endpoint=>app.evaluate(({webContents},{url,endpoint})=>webContents.getAllWebContents().find(c=>c.getURL()===url+endpoint)?.id,{url,endpoint});
  const save=async endpoint=>{
    const shell=app.windows().find(p=>p.url().endsWith('/institution.html')&&!p.isClosed());
    await shell.waitForFunction(endpoint=>document.querySelector('#address').value.endsWith(endpoint),endpoint);
    await shell.locator('[data-action="save-close"]').click();
  };
  await open('/login');const shell=app.windows().find(p=>p.url().endsWith('/institution.html'));
  await shell.waitForFunction(()=>document.querySelector('#address').value.endsWith('/login'));
  const id=await remote('/login');await app.evaluate(({webContents},id)=>webContents.fromId(id).executeJavaScript('document.querySelector("form").requestSubmit()'),id);
  await save('/catalog');
  const search=query=>main.evaluate(({query,url})=>window.litgraphDesktop.institution('search',{portalUrl:url,originalQuery:query,filters:{resultCount:5},language:'en'}),{query,url});
  // Local ordinary test button, never a production CAPTCHA.
  await open('/manual-check');await save('/manual-check');
  await main.evaluate(({query,url})=>{window.searchWait=window.litgraphDesktop.institution('search',{portalUrl:url,originalQuery:query,filters:{resultCount:5},language:'en'}).then(r=>window.verifiedSearch=r,e=>window.searchFailure=e.message);},{query:title,url});
  await shell.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Waiting for authentication'));
  const challengeId=await remote('/manual-check');
  assert.equal(await app.evaluate(({webContents},id)=>webContents.fromId(id).debugger.isAttached(),challengeId),false);
  const beforeWait=requests.length;await new Promise(r=>setTimeout(r,500));assert.equal(requests.length,beforeWait);
  await app.evaluate(({webContents},id)=>webContents.fromId(id).executeJavaScript('document.querySelector("button").click()'),challengeId);
  await shell.waitForFunction(()=>document.querySelector('#address').value.endsWith('/catalog'));
  await shell.locator('[data-action="save-close"]').click();
  await main.waitForFunction(()=>window.verifiedSearch||window.searchFailure,null,{timeout:30000});
  assert.equal(await main.evaluate(()=>window.searchFailure),undefined);
  assert.equal(await main.evaluate(()=>window.verifiedSearch.papers[0].title),title);
  console.log('PASS search releases instrumentation during manual verification and resumes in place');
  const first=await search(title);
  assert.equal(first.papers.length,2);assert.equal(first.papers[0].title,title);
  assert.match(first.papers[0].sourceUrl,/fulldisplay\?docid=record_1CitationCount/);
  assert.equal(first.papers[1].title,'Open scholarship and library interoperability: A framework');
  assert.equal(first.diagnostics.pages,2);assert.ok(requests.filter(r=>r.path==='/results').every(r=>r.signed));
  assert.ok(requests.some(r=>r.path==='/results'&&r.query===title));
  console.log('PASS exact full query, authenticated SPA search, Primo CitationCount, button pagination and stale-result exclusion');
  const acquired=await main.evaluate(({paper,url})=>window.litgraphDesktop.institution('acquire',{portalUrl:url,url:paper.sourceUrl,institutionRecordUrl:paper.sourceUrl,title:paper.title,language:'en'}),{paper:first.papers[0],url});assert.equal(Buffer.from(acquired.data,'base64').toString(),pdf);
  assert.ok(requests.filter(r=>['/results','/discovery/fulldisplay','/resolver','/publisher/article','/paper.pdf'].includes(r.path)).every(r=>r.signed));
  console.log('PASS searched record -> institution resolver -> publisher -> validated PDF, all using the original signed-in session');
  const bilingualQueries=['social commerce impulsive buying','社交电商 冲动购买','online impulse purchasing','网络 冲动消费'];
  const multi=await main.evaluate(({url,queries,title})=>window.litgraphDesktop.institution('search',{portalUrl:url,originalQuery:title,queries,filters:{resultCount:5},language:'en'}),{url,queries:bilingualQueries,title});
  assert.equal(multi.queryReports.length,5);
  assert.ok(multi.queryReports.every(r=>r.status==='completed'),JSON.stringify(multi.queryReports));
  assert.ok(bilingualQueries.every(q=>requests.some(r=>r.path==='/results'&&r.query===q&&r.signed)));
  assert.ok(multi.papers.every(p=>p.searchMatches?.length));
  console.log('PASS all bilingual combinations run in the original authenticated browser session');
  const repeated=await search(title);assert.equal(repeated.papers[0].title,title);
  await open('/catalog');await save('/catalog');
  const quiet=await search('Quiet original title with delayed search results');assert.equal(quiet.papers.length,1);assert.equal(quiet.papers[0].title,'Quiet original title with delayed search results');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/institution.html')).show());
  await shell.locator('[data-action="save-close"]').click();
  const sameStarted=Date.now();const identical=await search('Quiet original title with delayed search results');assert.equal(identical.papers[0].title,quiet.papers[0].title);assert.ok(Date.now()-sameStarted>=1100,'Wait for the identical result replacement, not merely the existing title');
  console.log('PASS no-busy SPA URL changes and identical repeated-result commits');
  const empty=await search('empty');assert.deepEqual(empty.papers,[]);
  await assert.rejects(search('unsupported'),/records could not be read|confirmed results/);
  console.log('PASS confirmed empty is distinct from unsupported result extraction');
  await open('/embedded');await save('/embedded');const embedded=await search(title);assert.equal(embedded.papers[0].title,title);
  await open('/embedded-wrapper');await save('/embedded-wrapper');const wrapper=await search(title);assert.equal(wrapper.papers[0].title,title);assert.ok(!requests.some(r=>r.path==='/wrong-site-search'));
  await open('/embedded-cross');await save('/embedded-cross');const cross=await search(title);assert.equal(cross.papers[0].title,title);assert.equal(new URL(cross.sourceUrl).port,String(secondaryPort));
  console.log('PASS embedded catalogue search and pagination share the authenticated browser');
  await open('/popup-search');await save('/popup-search');const popup=await search(title);assert.equal(popup.papers[0].title,title);
  console.log('PASS search opened into a task-owned authenticated popup');
  console.log(JSON.stringify({passed:true,packaged:Boolean(executable),dataRoot}));
}finally{await app?.close().catch(()=>{});fixture.closeAllConnections();secondary.closeAllConnections();await Promise.all([new Promise(resolve=>fixture.close(resolve)),new Promise(resolve=>secondary.close(resolve))]);}
