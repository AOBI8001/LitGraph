// Authenticated library record -> observed resolver -> publisher -> PDF.
// All hosts are local fixtures and use a fresh, isolated desktop profile.
import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const root=process.cwd();await mkdir('output/desktop',{recursive:true});
const dataRoot=await mkdtemp(path.join(root,'output/desktop/library-fulltext-'));
const pdf='%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF';
const requests=[];
const fixture=http.createServer((req,res)=>{
  requests.push({url:req.url,signed:/library_session=fixture/.test(req.headers.cookie||'')});
  const signed=/library_session=fixture/.test(req.headers.cookie||'');
  if(req.url==='/login'){res.writeHead(200,{'Content-Type':'text/html','Set-Cookie':'library_session=fixture; HttpOnly; SameSite=Lax; Path=/'});return res.end('<title>Local fixture login</title><h1>Test institution authenticated</h1>');}
  if(!signed){res.writeHead(403,{'Content-Type':'text/html'});return res.end('<title>Access denied</title>');}
  if(req.url?.startsWith('/login?url=')){res.writeHead(302,{'Location':new URL(req.url,'http://127.0.0.1').searchParams.get('url')});return res.end();}
  if(req.url==='/paper.pdf'){res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="fixture.pdf"'});return res.end(pdf);}
  res.writeHead(200,{'Content-Type':'text/html'});
  if(req.url?.startsWith('/discovery/fulldisplay'))return res.end('<title>Primo full record</title><prm-full-view><h1>Observed institutional routes: A study</h1><a href="#viewOnline">Full text available</a><prm-alma-viewit id="viewOnline"><prm-service-details><a href="/resolver/opaque?cdi_id=123CitationCount">Elsevier Reading Collection</a></prm-service-details></prm-alma-viewit></prm-full-view>');
  if(req.url?.startsWith('/resolver/opaque'))return res.end('<title>Institution resolver</title><section><h2>Online access</h2><button onclick="window.open(\'/publisher/article\',\'institution-resource\')">View full text</button></section>');
  if(req.url==='/publisher/article')return res.end('<meta name="citation_doi" content="10.1000/fixture"><meta name="citation_title" content="Observed institutional routes: A study"><h1>Observed institutional routes: A study</h1><button onclick="location.href=\'/paper.pdf\'">Download PDF</button>');
  if(req.url==='/record/generic')return res.end('<title>Generic library record</title><h1>Observed institutional routes: A study</h1><section><h2>View online</h2><a href="/publisher/article">Access from licensed collection</a><a href="/forbidden/related">Recommended paper</a><a href="/forbidden/purchase">Purchase this article</a></section><nav><a href="/forbidden/nav">Full text</a></nav><section class="references"><a href="/forbidden/references">Full text</a></section>');
  if(req.url==='/record/dynamic')return res.end('<title>Dynamic library record</title><h1>Observed institutional routes: A study</h1><button onclick="this.disabled=true;setTimeout(()=>document.querySelector(\'#links\').innerHTML=\'<section><h2>View online</h2><a href=/publisher/article>Licensed full text</a></section>\',200)">View online</button><div id="links"></div>');
  if(req.url==='/record/ezproxy')return res.end('<title>Library full record</title><section><h2>View online</h2><a href="/login?url='+encodeURIComponent('http://'+req.headers.host+'/publisher/article')+'">Licensed publisher collection</a></section>');
  if(req.url==='/record/wrong-doi')return res.end('<title>Library record</title><section class="online-access"><a href="/doi/full/10.1000/wrong">Other collection</a></section>');
  if(req.url==='/record/wrong-title')return res.end('<title>Library record</title><section class="online-access"><a href="/publisher/wrong-title">Licensed collection</a></section>');
  if(req.url==='/publisher/wrong-title')return res.end('<meta name="citation_title" content="An entirely different study"><a href="/paper.pdf">Download PDF</a>');
  res.end('<title>Unknown local fixture route</title>');
});
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${fixture.address().port}`;
const env={...process.env,LITGRAPH_TEST_MODE:'1',LITGRAPH_TEST_DATA:dataRoot};delete env.ELECTRON_RUN_AS_NODE;
let app;
try{
  app=await electron.launch({executablePath:process.env.LITGRAPH_TEST_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.LITGRAPH_TEST_EXECUTABLE?[]:[root],env,timeout:45000});
  const page=await app.firstWindow();await page.locator('#empty-model-access').waitFor();
  await page.evaluate(url=>window.litgraphDesktop.institution('open',{portalUrl:url,url:url+'/login',language:'en'}),url);
  for(let i=0;i<30&&!requests.some(r=>r.url==='/login');i++)await new Promise(resolve=>setTimeout(resolve,100));
  assert.ok(requests.some(r=>r.url==='/login'));
  const acquire=(endpoint,extra={})=>page.evaluate(({url,endpoint,extra})=>window.litgraphDesktop.institution('acquire',{portalUrl:url,url:url+endpoint,doi:'10.1000/fixture',title:'Observed institutional routes: A study',language:'en',timeoutMs:20000,...extra}),{url,endpoint,extra});
  for(const endpoint of ['/discovery/fulldisplay?docid=cdi_123CitationCount','/record/generic','/record/dynamic','/record/ezproxy']){
    const result=await acquire(endpoint);
    assert.equal(Buffer.from(result.data,'base64').toString(),pdf,endpoint);
    console.log('Same-session institution full text passed: '+endpoint);
  }
  await assert.rejects(acquire('/record/wrong-doi'),/No usable/);
  await assert.rejects(acquire('/record/wrong-title',{doi:''}),/title does not match/);
  assert.equal(requests.some(r=>r.url.startsWith('/forbidden')||r.url.startsWith('/doi/full/10.1000/wrong')),false);
  assert.equal(requests.filter(r=>r.url!=='/login').every(r=>r.signed),true,'Resolver and publisher requests retain the authenticated native session');
  assert.equal((await page.evaluate(()=>window.litgraphDesktop.institution('list'))).length,0,'Automated popup PDF is not duplicated as a manual receipt');
  console.log('Institution bridge rejects unrelated navigation and conflicting DOI/title; all download requests reused the native session');
}finally{await app?.close().catch(()=>{});fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve));}
