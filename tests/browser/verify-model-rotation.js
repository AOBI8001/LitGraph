async page => {
  const backup=await page.evaluate(()=>({...localStorage}));const pattern='**/src/main.js*';
  const inject=async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+`\nwindow.__modelQA={initialFramingPoints,sample(){activateProjectData(createSampleProject(),SAMPLE_PROJECT_ID)},setView,setLayoutBasis,setRenderMode,renderInspector,closeInspectorPanel,applyTheme,get graph(){return graph3d},get rotation(){return modelRotation},get guides(){return graph3dYearGuideGroup},get nodes(){return nodes},panel(p){activePanel=p;renderSecondaryPanel()},lang(l){language=l;applyLanguage()},fakeAI(){aiConfig={endpoint:'https://litgraph-ui-test.invalid/v1',apiKey:'test-not-a-secret',verified:true,model:'test',protocol:'openai-chat'}},node(n){selectedNode=n;renderInspector(n)}};`});};
  const assert=(v,m)=>{if(!v)throw new Error(m);};const reports=[];let translations=0;let stage='init';
  const api=async route=>{translations++;await route.fulfill({json:{choices:[{message:{content:'This study reports a qualified association, not a causal conclusion.'},finish_reason:'stop'}]}});};
  try{
    await page.route(pattern,inject);await page.route('https://litgraph-ui-test.invalid/**',api);
    await page.setViewportSize({width:1329,height:958});await page.reload();await page.waitForFunction(()=>window.__modelQA);
    await page.evaluate(()=>{window.__modelQA.sample();window.__modelQA.fakeAI();window.__modelQA.lang('zh')});
    for(const view of ['semantic'])for(const basis of ['argument','semantic']){
      stage=view+':'+basis;
      await page.evaluate(()=>window.__modelQA.graph?.cooldownTicks(300));
      await page.evaluate(({view,basis})=>{const q=window.__modelQA;q.setRenderMode('2d');q.setView(view);q.setLayoutBasis(basis);q.setRenderMode('3d')},{view,basis});
      await page.waitForFunction(()=>window.__modelQA.rotation&&document.querySelector('#graph-3d-status').hidden);await page.waitForTimeout(1200);
      await page.evaluate(()=>window.__modelQA.graph.cooldownTicks(0));await page.waitForTimeout(180);
      const state=()=>page.evaluate(()=>{const q=window.__modelQA,g=q.graph,root=g.scene().children.find(c=>typeof c.graphData==='function'),center=q.rotation.pivot.clone();for(const axis of ['x','y','z']){const values=q.initialFramingPoints(g.graphData().nodes).map(n=>n[axis]);center[axis]=(Math.min(...values)+Math.max(...values))/2;}return {eye:g.camera().position.toArray(),cameraQ:g.camera().quaternion.toArray(),target:g.controls().target.toArray(),q:root.quaternion.toArray(),pivot:root.localToWorld(center).toArray(),guide:q.guides?.quaternion.toArray()};});
      const before=await state();const b=await page.locator('#graph-3d').boundingBox();
      await page.mouse.move(b.x+45,b.y+75);await page.mouse.down();await page.mouse.move(b.x+145,b.y+120,{steps:16});await page.mouse.up();await page.waitForTimeout(150);
      const after=await state();const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
      assert(distance(before.eye,after.eye)<1e-6,'Camera position changed');assert(distance(before.cameraQ,after.cameraQ)<1e-6,'Camera direction changed');
      assert(distance(before.target,after.target)<1e-6,'Camera target changed');assert(distance(before.q,after.q)>.01,'Model did not rotate '+view+basis);
      assert(distance(before.pivot,after.pivot)<.01,'Model center shifted');if(after.guide)assert(distance(after.q,after.guide)<1e-6,'Year planes do not follow model');
      // Project transformed node centers, then exercise the real raycasting/click path.
      const candidates=await page.evaluate(()=>{
        const q=window.__modelQA,g=q.graph,root=g.scene().children.find(c=>typeof c.graphData==='function');
        const host=document.querySelector('#graph-3d').getBoundingClientRect();
        return g.graphData().nodes.map(n=>{
          const point=root.position.clone().set(n.x,n.y,n.z);root.localToWorld(point);point.project(g.camera());
          return {id:n.id,x:host.x+(point.x+1)*host.width/2,y:host.y+(1-point.y)*host.height/2,z:point.z};
        }).filter(n=>n.z<1&&n.z>-1&&n.x>host.x+100&&n.x<host.right-120&&n.y>host.top+80&&n.y<host.bottom-90).sort((a,b)=>a.z-b.z);
      });
      let picked=false;
      for(const n of candidates.slice(0,12)){
        await page.mouse.move(n.x,n.y);await page.waitForTimeout(120);await page.mouse.click(n.x,n.y);
        if(await page.locator('#inspector').evaluate(el=>el.classList.contains('open'))){picked=true;break;}
      }
      if(!picked)await page.screenshot({path:'output/playwright/picking-failure.png'});
      assert(picked,'Rotated nodes cannot be selected '+view+basis+' candidates='+JSON.stringify(candidates.slice(0,3)));
      await page.evaluate(()=>window.__modelQA.closeInspectorPanel());
      await page.waitForTimeout(650);
      reports.push({view,basis,cameraFixed:true,modelRotates:true,pivotFixed:true,nodePicking:true});
    }
    await page.screenshot({path:'output/playwright/model-rotation.png'});
    await page.evaluate(()=>{const q=window.__modelQA;q.setRenderMode('2d');q.panel('background')});
    const ids=await page.locator('[data-canvas-background]').evaluateAll(els=>els.map(e=>e.dataset.canvasBackground));
    assert(JSON.stringify(ids)===JSON.stringify(['light','dark','stardust','paper','rose','lavender','lagoon','cosmos']),'Wrong order');
    await page.locator('[data-canvas-background="rose"]').click();await page.evaluate(()=>window.__modelQA.applyTheme('dark'));
    assert(await page.locator('[data-canvas-background="dark"]').getAttribute('aria-pressed')==='true','Night should reset to black');
    await page.locator('[data-canvas-background="lavender"]').click();assert(await page.locator('html').getAttribute('data-theme')==='dark','Background changed chrome');
    await page.evaluate(()=>window.__modelQA.applyTheme('light'));assert(await page.locator('[data-canvas-background="light"]').getAttribute('aria-pressed')==='true','Day should reset to white');
    await page.screenshot({path:'output/playwright/backgrounds-detailed.png'});
    stage='summary';await page.evaluate(()=>{const q=window.__modelQA;q.panel(null);q.lang('en');const n=q.nodes[0];n.aiSummaryZh='这项研究只报告相关，不能视为因果结论。';delete n.aiSummaryEn;n.summary='中文总结';q.node(n)});
    await page.waitForFunction(()=>document.querySelector('#editable-summary')?.textContent.includes('qualified association'));
    await page.evaluate(()=>window.__modelQA.lang('zh'));assert((await page.locator('#editable-summary').innerText()).includes('不能视为因果'),'Chinese lost');
    await page.evaluate(()=>window.__modelQA.lang('en'));assert((await page.locator('#editable-summary').innerText()).includes('qualified association'),'English not cached');
    assert(translations===1,'Repeated translation requests');
    return{reports,backgroundOrder:ids,themeBackgroundCoupling:true,englishSummaryCached:true,translations};
  }catch(error){throw new Error(stage+': '+error.message+'; '+await page.locator('#editable-summary').textContent().catch(()=>''));}finally{await page.unroute(pattern,inject);await page.unroute('https://litgraph-ui-test.invalid/**',api);await page.evaluate(saved=>{localStorage.clear();Object.entries(saved).forEach(([k,v])=>localStorage.setItem(k,v))},backup);await page.reload();}
}
