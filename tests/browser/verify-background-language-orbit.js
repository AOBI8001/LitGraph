async (page) => {
  const backup = await page.evaluate(() => ({...localStorage}));
  const errors=[]; const onError=e=>errors.push(e.message); page.on('pageerror',onError);
  const pattern='**/src/main.js*';
  const inject=async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+`\nwindow.__uiQA={setView,setLayoutBasis,setRenderMode,openModal,closeModal,openDeepReadWindow,openLiteratureDiscoveryWindow,renderInspector,closeInspectorPanel, get nodes(){return nodes}, get graph(){return graph3d}, get texture(){return graphBackgroundTexture}, get bg(){return currentBackground().id}, language(value){language=value;applyLanguage()}, panel(value){activePanel=value;renderSecondaryPanel()}, stop(){simulation.stop()}, fit(){fitGraph3D(0)},setBackground(id){canvasBackground=id;render();},get mainTheme(){return theme}};`});
  };
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const audit=async selector=>page.locator(selector).evaluate(root=>{
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT), out=[];
    while(walker.nextNode()) {
      const n=walker.currentNode,p=n.parentElement;
      if(!p.checkVisibility() || p.closest('option, .saved-project-list, #project-selector-label, .chat-message, .research-tab b, .theory-filter-list, .data-view tbody'))continue;
      const v=n.nodeValue.trim();if(/[\u3400-\u9fff]/.test(v))out.push(v);
    }
    return [...new Set(out)];
  });
  const report={languages:{},backgrounds:[],orbit:[],windows:[]};
  try {
    await page.route(pattern,inject);await page.setViewportSize({width:1329,height:958});await page.reload();
    await page.waitForFunction(()=>window.__uiQA);await page.evaluate(()=>window.__uiQA.language('en'));
    assert(!await page.locator('#graph-3d-keys').isVisible(),'3D key legend visible in 2D');
    for(const panel of ['view-mode','nodes','edges','labels','background','filters','statistics','workspace-settings']){
      await page.evaluate(p=>window.__uiQA.panel(p),panel);await page.waitForTimeout(280);
      report.languages[panel]=await audit('#secondary-panel');
    }
    await page.evaluate(()=>window.__uiQA.panel('background'));
    assert(await page.locator('[data-canvas-background]').count()===8,'Eight background choices');
    for(const id of ['light','dark','stardust','cosmos','rose','lagoon','paper','lavender']){
      await page.locator(`[data-canvas-background="${id}"]`).click();
      const s=await page.evaluate(()=>({bg:window.__uiQA.bg,theme:window.__uiQA.mainTheme,pressed:document.querySelector('[data-canvas-background][aria-pressed="true"]').dataset.canvasBackground}));
      assert(s.bg===id&&s.pressed===id&&s.theme==='light','Canvas-only background '+id);report.backgrounds.push(s);
    }
    await page.screenshot({path:'output/playwright/background-thumbnails.png'});
    await page.evaluate(()=>window.__uiQA.panel(null));
    for(const modal of ['api','about','paper-import']){
      await page.evaluate(id=>window.__uiQA.openModal(id),modal);
      report.languages[modal]=await audit('#'+modal+'-modal');
      if(modal==='api') {
        await page.locator('#toggle-api-key').click();
        await page.evaluate(()=>window.__uiQA.language('zh'));
        assert(await page.locator('#toggle-api-key').innerText()==='隐藏','Visible key toggle not localized');
        await page.evaluate(()=>window.__uiQA.language('en'));
        assert(await page.locator('#toggle-api-key').innerText()==='Hide','Visible key toggle not localized to English');
        await page.locator('#toggle-api-key').click();
      }
      await page.evaluate(id=>window.__uiQA.closeModal(id),modal);
    }
    await page.evaluate(()=>window.__uiQA.setView('table'));
    report.languages.data=await audit('#data-view');
    await page.evaluate(()=>window.__uiQA.setView('semantic'));
    for(const kind of ['research','discovery']){
      await page.evaluate(k=>k==='research'?window.__uiQA.openDeepReadWindow():window.__uiQA.openLiteratureDiscoveryWindow(),kind);
      const selector=kind==='research'?'.deep-read-window':'.literature-discovery-window';
      const header=selector+(kind==='research'?' .summary-window-header':' .discovery-window-header');
      report.languages[kind]=await audit(selector);
      await page.evaluate(()=>window.__uiQA.language('zh'));
      assert((await page.locator(header).innerText()).includes(kind==='research'?'研究空间':'文献发现'),'Live Chinese header');
      await page.evaluate(()=>window.__uiQA.language('en'));
      const before=await page.locator(selector).boundingBox();
      // Pointer remains in the viewport while the window crosses the sidebar and top edge.
      const h=await page.locator(header).boundingBox();
      await page.mouse.move(h.x+h.width*.65,h.y+12);await page.mouse.down();
      await page.mouse.move(60,12,{steps:12});await page.mouse.up();
      const after=await page.locator(selector).boundingBox();
      assert(after.x<100&&after.y<65,kind+' drag is clamped: '+JSON.stringify(after));
      report.windows.push({kind,before,after});
      // Restore a visible location, then verify resizing continues to work.
      await page.locator(selector).evaluate(el=>{el.style.left='260px';el.style.top='40px';});
      const r=await page.locator(selector).boundingBox();
      await page.mouse.move(r.x+r.width-2,r.y+r.height*.5);await page.mouse.down();
      await page.mouse.move(r.x+r.width-72,r.y+r.height*.5,{steps:5});await page.mouse.up();
      assert((await page.locator(selector).boundingBox()).width<r.width-40,'Resize failed '+kind);
      await page.screenshot({path:'output/playwright/'+kind+'-english-window.png'});
      await page.locator(selector+(kind==='research'?' [data-close]':' #close-literature-discovery')).click();
    }
    for(const view of ['semantic','timeline'])for(const basis of ['argument','semantic']){
      await page.evaluate(({view,basis})=>{const q=window.__uiQA;q.setRenderMode('2d');q.setView(view);q.setLayoutBasis(basis);q.setRenderMode('3d');}, {view,basis});
      await page.waitForFunction(()=>window.__uiQA.graph&&document.querySelector('#graph-3d-status').hidden);
      await page.waitForTimeout(3500);
      await page.evaluate(()=>window.__uiQA.graph.cooldownTicks(0));
      await page.waitForTimeout(300);
      const getCamera=()=>page.evaluate(()=>{
        const g=window.__uiQA.graph,target={...g.controls().target},position={...g.camera().position};
        const center=Object.fromEntries(['x','y','z'].map(a=>{const values=g.graphData().nodes.map(n=>n[a]);return[a,(Math.min(...values)+Math.max(...values))/2]}));
        return{target,position,center};
      });
      const before=await getCamera();const box=await page.locator('#graph-3d').boundingBox();
      await page.mouse.move(box.x+45,box.y+100);await page.mouse.down();await page.mouse.move(box.x+130,box.y+145,{steps:15});await page.mouse.up();
      await page.waitForTimeout(250);const after=await getCamera();
      const delta=(a,b)=>Math.hypot(...['x','y','z'].map(k=>a[k]-b[k]));
      assert(delta(before.target,after.target)<.01,'Orbit pivot moved during drag');
      assert(delta(before.position,after.position)<.01,'Model drag moved camera');
      report.orbit.push({view,basis,pivotDelta:delta(before.target,after.target),centerDistance:delta(before.target,before.center)});
      for(const id of ['stardust','cosmos','rose']){
        await page.evaluate(id=>window.__uiQA.setBackground(id),id);await page.waitForTimeout(180);
        assert(await page.evaluate(()=>window.__uiQA.graph.scene().background===window.__uiQA.texture),'3D background absent');
      }
    }
    await page.evaluate(()=>{window.__uiQA.language('zh');window.__uiQA.setBackground('stardust');});
    report.legends=await page.evaluate(()=>{
      const a=document.querySelector('#graph-3d-keys'),b=document.querySelector('.graph-legend'),s=getComputedStyle(a),t=getComputedStyle(b),r=a.getBoundingClientRect(),q=b.getBoundingClientRect(),stage=document.querySelector('#graph-stage').getBoundingClientRect();
      return {same:['padding','borderRadius','border','fontSize','lineHeight','backgroundColor','boxShadow','gap'].every(k=>s[k]===t[k]),marginLeft:r.left-stage.left,marginRight:stage.right-q.right,bottom:Math.abs(r.bottom-q.bottom),gap:q.left-r.right};
    });
    assert(report.legends.same&&Math.abs(report.legends.marginLeft-report.legends.marginRight)<1&&report.legends.bottom<1&&report.legends.gap>=0,'Legends differ');
    await page.screenshot({path:'output/playwright/3d-stardust-legends.png'});
    report.errors=errors;assert(!errors.length,'Page errors: '+errors.join(';'));
    assert(Object.values(report.languages).every(a=>a.length===0),'Untranslated UI: '+JSON.stringify(report.languages));
    return report;
  } finally {
    page.off('pageerror',onError);await page.unroute(pattern,inject);
    await page.evaluate(saved=>{localStorage.clear();Object.entries(saved).forEach(([k,v])=>localStorage.setItem(k,v));},backup);await page.reload();
  }
}
