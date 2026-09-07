async page => {
  const saved = await page.evaluate(() => ({...localStorage}));
  let mode = 'ok', sentCount = 0, release;
  const main = async route => {
    const response = await route.fetch();
    await route.fulfill({response, body: await response.text() + `\nwindow.__controlsQA={createBlankProject,openLiteratureDiscoveryWindow,get searching(){return discoverySearching},get results(){return discoveryResults},get notice(){return discoveryNotice},setup(l){language=l;applyLanguage();aiConfig={endpoint:'https://litgraph-control-test.invalid/v1',apiKey:'test-only',model:'qa-model',protocol:'openai-chat',verified:true};discoveryQuery='Test subject';Object.assign(discoveryFilters,{yearStart:'2020',yearEnd:'2026',language:'en',articleType:'any',source:'open',resultCount:20});renderLiteratureDiscoveryWindow()}};`});
  };
  const model = async route => {
    if(mode === 'pause') await new Promise(r => release=r);
    const input = JSON.parse(route.request().postDataJSON().messages.at(-1).content);
    const result = input.papers
      ? {assessments: mode === 'invalid' ? [{id:'invented',score:99,reason:'not accepted'}] : input.papers.map(p=>({id:p.id,score:80,reason:'Relevant verified test record.'}))}
      : {queries:['Test subject'],summary:'Test search plan.'};
    await route.fulfill({json:{choices:[{message:{content:JSON.stringify(result)},finish_reason:'stop'}]}}).catch(()=>{});
  };
  const search = async route => {
    const {filters} = route.request().postDataJSON(); sentCount=filters.resultCount;
    const count = Math.min(200, Number(sentCount)*2);
    await route.fulfill({json:{papers:Array.from({length:count},(_,i)=>({recordId:`test-${i}`,title:`Synthetic test paper ${i}`,authors:['A','B'],doi:`10.0000/test-${i}`,year:2024,language:'en',articleType:'research',sourceUrl:'https://example.org/paper',metadataSource:'Test fixture',citations:null,isOpenAccess:true,abstract:'This is a synthetic UI fixture, not a real paper.'})),sources:['Test fixture'],warnings:[],incomplete:false}});
  };
  const assert=(v,m)=>{if(!v)throw new Error(m)};
  try {
    await page.route('**/src/main.js*',main);
    await page.route('https://litgraph-control-test.invalid/**',model);
    await page.route('**/__litgraph/search',search);
    await page.setViewportSize({width:1329,height:958});
    await page.reload(); await page.waitForFunction(()=>window.__controlsQA);
    await page.evaluate(()=>{const q=window.__controlsQA;q.createBlankProject();q.openLiteratureDiscoveryWindow()});
    for(const lang of ['zh','en']){
      await page.evaluate(l=>window.__controlsQA.setup(l),lang);
      const bounds=await page.locator('.discovery-conditions').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight}));
      assert(bounds.scroll<=bounds.height+2,`${lang}: default filters overflow ${JSON.stringify(bounds)}`);
    }
    await page.locator('[data-discovery-filter="resultCount"][data-discovery-value="200"]').click();
    await page.locator('#start-discovery').click();
    await page.waitForFunction(()=>!window.__controlsQA.searching);
    assert(sentCount===200,'Count not transmitted');
    assert(await page.locator('[data-discovery-result]').count()===200,'Large result list incomplete');
    const tags=await page.locator('.discovery-result-tags').first().evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
    assert(tags.scroll<=tags.width+2,'Result sources overflow');
    await page.screenshot({path:'output/playwright/discovery-200-results.png'});
    mode='invalid';
    await page.locator('[data-discovery-filter="resultCount"][data-discovery-value="10"]').click();
    await page.locator('#start-discovery').click();
    await page.waitForFunction(()=>!window.__controlsQA.searching);
    const invalid=await page.evaluate(()=>({results:window.__controlsQA.results,notice:window.__controlsQA.notice}));
    assert(invalid.results.length===10&&invalid.results.every(p=>p.recordId.startsWith('test-')),'Model invented IDs entered results');
    assert(invalid.notice.includes('await AI analysis'),'Analysis failure not disclosed');
    mode='pause';
    await page.locator('#start-discovery').click();
    await page.waitForFunction(()=>window.__controlsQA.searching);
    await page.locator('#start-discovery').click();
    await page.waitForFunction(()=>!window.__controlsQA.searching);
    assert((await page.evaluate(()=>window.__controlsQA.notice)).includes('Search stopped'),'Stop did not cancel');
    release?.();
    return {defaultNoScroll:['zh','en'],requested200:true,modelFailurePreservesRealRecords:true,stop:true};
  } finally {
    release?.();
    await page.unroute('**/src/main.js*',main);
    await page.unroute('https://litgraph-control-test.invalid/**',model);
    await page.unroute('**/__litgraph/search',search);
    await page.evaluate(backup=>{localStorage.clear();Object.entries(backup).forEach(([k,v])=>localStorage.setItem(k,v))},saved);
    await page.reload();
  }
}
