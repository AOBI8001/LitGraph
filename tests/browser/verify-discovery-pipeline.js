async page=>{
 const backup=await page.evaluate(()=>({...localStorage})),pattern='**/src/main.js*';
 const inject=async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nwindow.__discoveryQA={createBlankProject,openLiteratureDiscoveryWindow,runLiteratureDiscovery,confirmDiscoveryImport,renderLiteratureDiscoveryWindow,renderInspector,openPaper,prepareEvidence,originalBlob,localRequest,get nodes(){return nodes},get filters(){return discoveryFilters},get results(){return discoveryResults},get searching(){return discoverySearching},get importing(){return discoveryImporting},get notice(){return discoveryNotice},get projectId(){return currentProjectId},pick(id){discoverySelected.add(id);renderLiteratureDiscoveryWindow()},lang(l){language=l;applyLanguage()},configure(protocol){aiConfig={endpoint:'https://litgraph-model-test.invalid/v1',apiKey:'fake-verification-key',model:'qa-model',protocol,verified:true};},setup(){discoveryQuery='The PRISMA 2020 statement updated guideline';Object.assign(discoveryFilters,{yearStart:'2021',yearEnd:'2021',language:'en',articleType:'any',source:'open',resultCount:5});renderLiteratureDiscoveryWindow()}};`});};
 const assert=(v,m)=>{if(!v)throw new Error(m);},report=[];
 const stub=async route=>{
  const body=route.request().postDataJSON(),messages=body.messages||body.input;
  const user=JSON.parse(messages.filter(m=>m.role==='user').at(-1).content);
  const result=user.original_excerpts?{summary:'原文片段已用于提取内容；请核对研究的适用范围。',label:'报告指南',keywords:['reporting'],theory:{label:'报告指南',labelEn:'Reporting guidelines'},relationships:[]}:user.papers?{assessments:user.papers.map((p,i)=>({id:p.id,score:50+i*8,reason:'Source-backed reporting guideline relevant to this query.'}))}:{queries:['The PRISMA 2020 statement updated guideline'],summary:'Search exact topic in scholarly sources.'};
  const text=JSON.stringify(result);
  await route.fulfill({json:route.request().url().endsWith('/messages')?{content:[{type:'text',text}],stop_reason:'end_turn'}:route.request().url().endsWith('/responses')?{status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]}:{choices:[{message:{content:text},finish_reason:'stop'}]}});
 };
 try{
  await page.route(pattern,inject);await page.route('https://litgraph-model-test.invalid/**',stub);await page.setViewportSize({width:1329,height:958});
  for(const protocol of ['openai-chat','anthropic-messages','openai-responses']){
   await page.reload();await page.waitForFunction(()=>window.__discoveryQA);
   await page.evaluate(protocol=>{const q=window.__discoveryQA;q.createBlankProject();q.configure(protocol);q.openLiteratureDiscoveryWindow();q.setup()},protocol);
   const presets=await page.locator('[data-discovery-filter="resultCount"]').allTextContents();assert(presets.slice(0,5).join(',')==='5,10,20,50,100','Count presets missing');
   await page.locator('#start-discovery').click();await page.waitForFunction(()=>!window.__discoveryQA.searching,{},{timeout:120000});
   const records=await page.evaluate(()=>window.__discoveryQA.results);assert(records.length>0&&records.length<=5,'Incorrect count: '+await page.evaluate(()=>window.__discoveryQA.notice));assert(records.every(p=>['OpenAlex','Europe PMC','Crossref'].includes(p.metadataSource)),'No real source: '+records.map(p=>p.metadataSource));assert(records.every(p=>p.language==='en'),'Language filter failed');
   await page.screenshot({path:`output/playwright/discovery-${protocol}-results.png`});
   if(protocol==='openai-chat'){
    const fixtureIndex=records.findIndex(p=>p.doi?.toLowerCase()==='10.1371/journal.pmed.1003583');
    assert(fixtureIndex>=0,'The real open-access PRISMA fixture was not returned; cannot assert a different paper is downloadable');
    await page.locator('[data-discovery-result]').nth(fixtureIndex).check();await page.locator('#discovery-confirm').click();await page.waitForFunction(()=>!window.__discoveryQA.importing,{},{timeout:120000});
    const n=await page.evaluate(()=>{const n=window.__discoveryQA.nodes[0];return n&&{id:n.id,doi:n.doi,title:n.title,status:n.fulltextStatus,error:n.fulltextError,key:n.fulltextKey,storageKey:n.fulltextStorageKey,md:n.markdownRelativePath,pdf:n.originalRelativePath,authors:n.authors.length,refs:n.referenceDois.length,project:window.__discoveryQA.projectId};});
    assert(n?.status==='indexed','Import not indexed: '+JSON.stringify(n));assert(n.md&&n.pdf&&n.authors>1&&n.refs>0,'Missing durable files or reference metadata');
    await page.evaluate(storageKey=>new Promise((resolve,reject)=>{const request=indexedDB.open('litgraph-fulltext',1);request.onsuccess=()=>{const tx=request.result.transaction('documents','readwrite');tx.objectStore('documents').delete(storageKey);tx.oncomplete=()=>{request.result.close();resolve()};tx.onerror=()=>reject(tx.error)};}),n.storageKey);
    await page.reload();await page.waitForFunction(()=>window.__discoveryQA);
    const evidence=await page.evaluate(async()=>{const q=window.__discoveryQA,n=q.nodes.find(n=>n.doi==='10.1371/journal.pmed.1003583')||q.nodes[0];const blob=await q.originalBlob(n);const result=await q.prepareEvidence([n],'What does PRISMA recommend?');q.renderInspector(n);return {bytes:blob?.size,coverage:result.coverage,evidence:result.evidence.length};});
    assert(evidence.bytes>10000&&evidence.evidence>0&&evidence.coverage[0].status==='source_text_available_excerpts_only','Disk recovery or evidence retrieval failed');
    const downloadPromise=page.waitForEvent('download');await page.locator('#open-pdf-button').click();await downloadPromise;
    report.push({protocol,realDownload:true,diskRecovery:true,originalButton:true,...n,evidence});
   }else report.push({protocol,search:true,analysis:true,count:records.length});
  }
  await page.evaluate(()=>{const q=window.__discoveryQA;q.lang('en');q.openLiteratureDiscoveryWindow()});
  await page.locator('[data-discovery-value="custom"]').click();await page.locator('#discovery-result-count').fill('0');await page.locator('#start-discovery').click();assert((await page.locator('.discovery-notice').innerText()).includes('5 to 100'),'Custom count validation missing');
  await page.screenshot({path:'output/playwright/discovery-custom-count.png'});
  return report;
 }finally{await page.unroute(pattern,inject);await page.unroute('https://litgraph-model-test.invalid/**',stub);await page.evaluate(saved=>{localStorage.clear();Object.entries(saved).forEach(([k,v])=>localStorage.setItem(k,v))},backup);await page.reload();}
}
