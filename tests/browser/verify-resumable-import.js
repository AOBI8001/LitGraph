async page => {
 const assert=(value,message)=>{if(!value)throw Error(message);};
 const backup=await page.evaluate(()=>({...localStorage}));
 const pattern='**/src/main.js*',model='https://litgraph-model-test.invalid/**';
 const source='The intervention improved response time in the experimental group. Methods and results were evaluated with original evidence.';
 const stream='BT /F1 12 Tf 40 700 Td ('+source+') Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];
 let pdf='%PDF-1.4\n',offsets=[];objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});
 const xref=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 const base64=await page.evaluate(text=>btoa(text),pdf);
 let slow=true,analyses=0,downloads=0,rollingIndexed=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const inject=async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nwindow.__resumeQA={localRequest,createBlankProject,openLiteratureDiscoveryWindow,openDeepReadWindow,renderInspector,processSinglePaper,get nodes(){return nodes},get history(){return discoveryHistory},get importing(){return discoveryImporting},get searching(){return discoverySearching},get tabs(){return researchTabs},get results(){return discoveryResults},get projectId(){return currentProjectId},show(node){selectedNode=node;renderInspector(node)},lang(l){language=l;applyLanguage()},configure(){aiConfig={endpoint:'https://litgraph-model-test.invalid/v1',apiKey:'fixture-only',model:'fixture',protocol:'openai-chat',verified:true};},setup(){discoveryQuery='Response inhibition';Object.assign(discoveryFilters,{yearStart:'2020',yearEnd:'2026',language:'any',articleType:'any',source:'open',resultCount:5});renderLiteratureDiscoveryWindow();}};`});};
 const papers=[0,1].map(i=>({recordId:'resume-fixture-'+i,title:'Synthetic response inhibition study '+i,authors:['A Example','B Example'],year:2024,language:'en',articleType:'research',isOpenAccess:true,metadataSource:'Synthetic test fixture',sourceUrl:'https://example.org/'+i,doi:'10.1234/resume'+i,journal:'Fixture Journal '+i,referenceDois:i?['10.1234/resume0']:[],pdfUrl:'https://example.org/'+i+'.pdf'}));
 const search=route=>route.fulfill({json:{papers,sources:['Synthetic test fixture'],warnings:[],incomplete:true}});
 const acquire=async route=>{
  downloads++;const data=route.request().postDataJSON();
  if(data.recordId==='resume-fixture-1'){
   // A slow/unavailable later source must not hold already downloaded PDFs
   // unconverted until the entire acquisition batch finishes.
   await page.waitForFunction(()=>window.__resumeQA.history[0]?.items[0]?.converted===true,null,{timeout:15000});
   rollingIndexed=true;
  }
  const saved=await page.evaluate(async data=>window.__resumeQA.localRequest('document',data),{projectId:data.projectId,nodeId:data.nodeId,fileName:'synthetic.pdf',originalData:base64});
  await route.fulfill({json:{...saved,metadata:papers.find(p=>p.recordId===data.recordId),data:base64,type:'application/pdf'}});
 };
 const modelReply=async route=>{
  const content=route.request().postDataJSON().messages.at(-1).content;
  let user;try{user=JSON.parse(content);}catch{await route.fulfill({json:{choices:[{message:{content:'The intervention group improved response time, based on the supplied original.'},finish_reason:'stop'}]}});return;}
  let result;
  if(user.original_excerpts){analyses++;if(slow)await page.waitForTimeout(4000);result={summary:'原文表明干预组反应时改善。',label:'反应时改善',keywords:['response inhibition'],theory:{label:'反应抑制',labelEn:'Response inhibition'},relationships:user.peers.map(p=>({targetId:p.id,relation:'support',strength:.8,rationale:'Both supplied originals report improved response time.',sourceQuote:'improved response time',targetQuote:'improved response time'}))};}
  else if(user.papers)result={assessments:user.papers.map(p=>({id:p.id,score:80,reason:'Matches the question.'}))};
  else result={queries:['response inhibition'],summary:'检索英文研究。'};
  await route.fulfill({json:{choices:[{message:{content:JSON.stringify(result)},finish_reason:'stop'}]}}).catch(()=>{});
 };
 try{
  await page.route(pattern,inject);await page.route('**/__litgraph/search',search);await page.route('**/__litgraph/acquire',acquire);await page.route(model,modelReply);
  await page.reload();await page.waitForFunction(()=>window.__resumeQA);await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>{const q=window.__resumeQA;q.createBlankProject();q.configure();q.openLiteratureDiscoveryWindow();q.setup();});
  await page.locator('#start-discovery').click();await page.waitForFunction(()=>!window.__resumeQA.searching);
  assert(await page.locator('.discovery-result-card').count()===2,'Results missing');
  await page.locator('#discovery-select-all').check();await page.locator('#discovery-confirm').click();
  await page.waitForFunction(()=>window.__resumeQA.history[0].items[0]?.stage==='analyzing');
  await page.locator('#discovery-confirm').click();await page.waitForFunction(()=>!window.__resumeQA.importing);
  const paused=await page.evaluate(()=>window.__resumeQA.history[0]);
  assert(paused.items[0].downloaded&&paused.items[0].converted&&!paused.items[0].analyzed,'Pause lost PDF / MD progress');
  assert((await page.locator('#discovery-confirm').innerText()).includes('继续'),'Resume button missing: '+await page.locator('#discovery-confirm').innerText()+' '+JSON.stringify(paused));
  await page.locator('#discovery-window-query').fill('Changed draft must not change results');
  await page.locator('[data-discovery-filter="language"][data-discovery-value="zh"]').click();
  assert(await page.locator('.discovery-result-card').count()===2,'Editing filters discarded results');
  assert((await page.locator('#discovery-confirm').innerText()).includes('继续'),'Editing discarded paused job');
  await page.locator('#discovery-history-toggle').click();
  assert(await page.locator('.discovery-history-row').count()>=1,'History missing');
  await page.locator('[data-history-expand]').first().click();
  await page.screenshot({path:'output/playwright/import-history-paused.png'});
  slow=false;
  await page.locator('[data-history-resume]').first().click();await page.locator('#close-literature-discovery').click();await page.waitForFunction(()=>!window.__resumeQA.importing,{},{timeout:45000});
  await page.evaluate(()=>window.__resumeQA.openLiteratureDiscoveryWindow());
  const done=await page.evaluate(()=>({job:window.__resumeQA.history[0],nodes:window.__resumeQA.nodes}));
  assert(done.job.status==='done','Resume incomplete: '+JSON.stringify(done.job));
  assert(downloads===2,'Resume redownloaded completed originals');
  assert(rollingIndexed,'First PDF did not become readable MD during the next acquisition');
  assert(done.nodes.every(n=>n.markdownRelativePath&&n.originalRelativePath&&n.analysisStatus==='done'),'Pipeline outputs missing');
  await page.screenshot({path:'output/playwright/import-history-complete.png'});
  await page.locator('#close-literature-discovery').click();
  await page.evaluate(()=>{const q=window.__resumeQA;q.show(q.nodes[0]);});
  assert(await page.locator('#process-paper-button').count()===0,'Completed paper still offers conversion');
  await page.evaluate(()=>{const q=window.__resumeQA;q.nodes[0].analysisStatus='pending';q.show(q.nodes[0]);});
  await page.locator('#process-paper-button').click();await page.waitForFunction(()=>!window.__resumeQA.importing);
  assert(downloads===2,'Single-paper analysis unnecessarily redownloaded original');
  const download=page.waitForEvent('download');await page.locator('#open-pdf-button').click();await download;
  // Journal filter is a union of selected journals, not a single selected value.
  await page.getByRole('button',{name:'筛选',exact:true}).click();
  await page.locator('#journal-filter > summary').click();await page.locator('[data-journal-choice]').nth(0).check();await page.locator('[data-journal-choice]').nth(1).check();
  assert(await page.locator('[data-journal-choice]:checked').count()===2,'Journal multiselect failed');
  await page.evaluate(()=>{const q=window.__resumeQA;q.openDeepReadWindow(q.nodes[0]);q.openDeepReadWindow(q.nodes[1]);});
  const before=await page.locator('[data-tab-id]').evaluateAll(els=>els.map(e=>e.dataset.tabId));
  const tabs=page.locator('[data-tab-id]');await tabs.nth(1).dragTo(tabs.nth(2),{targetPosition:{x:100,y:15}});
  const after=await page.locator('[data-tab-id]').evaluateAll(els=>els.map(e=>e.dataset.tabId));
  assert(before.join()!==after.join(),'Tabs did not reorder');assert(new Set(after).size===before.length,'Tab lost during drag');
  assert(!await page.locator('#drop-overlay').isVisible(),'Tab drag triggered file import overlay');
  await page.screenshot({path:'output/playwright/research-tabs-reordered.png'});
  await page.evaluate(()=>{window.__resumeQA.lang('en');window.__resumeQA.openLiteratureDiscoveryWindow();});await page.locator('#discovery-history-toggle').click();
  assert(await page.locator('#discovery-history-toggle').getAttribute('aria-label')==='Search and processing history','History label not translated');
  await page.screenshot({path:'output/playwright/import-history-english.png'});
  assert(errors.length===0,'Page errors: '+errors.join('; '));
  return {passed:true,downloads,analyses,rollingIndexed,stages:done.job.items.map(i=>i.stage),tests:['rolling PDF to MD','pause/resume','draft filters','history','disk PDF and MD','summary','single-paper repair','browser original download','journal multiselect','tab drag','English history']};
 } finally {
  await page.unroute(pattern,inject);await page.unroute(model,modelReply);await page.unroute('**/__litgraph/search',search);await page.unroute('**/__litgraph/acquire',acquire);
  await page.evaluate(async backup=>{localStorage.clear();Object.entries(backup).forEach(([k,v])=>localStorage.setItem(k,v));if(window.__resumeQA)await window.__resumeQA.localRequest('discovery-history',{jobs:JSON.parse(backup['litgraph.discoveryHistory.v1']||'[]')});},backup);
  await page.reload();
 }
}
