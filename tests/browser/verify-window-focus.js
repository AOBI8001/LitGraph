async (page) => {
  const backup=await page.evaluate(()=>({...localStorage}));
  const routePattern='**/src/main.js*';
  const inject=async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text())+`\nwindow.__focusQA={setView,setRenderMode,setLayoutBasis,clearCurrentNodeSelection,renderOverview,render, get ready(){return Boolean(graph3d)},get graph(){return graph3d},get state(){return {view,renderMode,layoutBasis,selected:selectedNode?.id,hovered:hoveredNode?.id}},stop(){simulation.stop()}, count2d(){let count=0;const stroke=context.stroke;context.stroke=()=>count++;try{drawLinks()}finally{context.stroke=stroke;render()}return count},points(){const r=canvas.getBoundingClientRect();return visibleNodes().map(n=>({id:n.id,x:r.left+(camera.x+n.x*camera.k)*r.width/canvas.clientWidth,y:r.top+(camera.y+n.y*camera.k)*r.height/canvas.clientHeight})).filter(p=>p.x>r.left+30&&p.x<r.right-80&&p.y>r.top+50&&p.y<r.bottom-100)}};`});
  };
  try {
    await page.route(routePattern,inject); await page.setViewportSize({width:1329,height:958}); await page.reload();
    await page.waitForFunction(()=>window.__focusQA);
    await page.getByRole('button',{name:'研究空间',exact:true}).click();
    await page.locator('.deep-read-window .tool-window-logo').waitFor();
    if(await page.locator('#deep-read-input').getAttribute('placeholder')!=='向当前选中论文提问')throw new Error('Wrong placeholder');
    const aligned=await page.locator('.research-composer-row').evaluate(row=>{
      const rects=[...row.children].map(el=>el.getBoundingClientRect());
      return Math.max(...rects.map(r=>r.y+r.height/2))-Math.min(...rects.map(r=>r.y+r.height/2))<1 && rects.every((r,i)=>!i||r.left>=rects[i-1].right);
    });
    if(!aligned)throw new Error('Composer controls misaligned');
    await page.screenshot({path:'output/playwright/research-logo-preference.png'});
    await page.getByRole('button',{name:'文献发现 AI',exact:true}).click();
    await page.locator('.literature-discovery-window .tool-window-logo').waitFor();
    await page.screenshot({path:'output/playwright/discovery-logo-layout.png'});
    await page.getByRole('button',{name:'关闭文献发现',exact:true}).click();
    const results=[];
    for(const view of ['semantic','timeline'])for(const basis of ['argument','semantic']) {
      await page.evaluate(({view,basis})=>{const q=window.__focusQA;q.setRenderMode('2d');q.setView(view);q.setLayoutBasis(basis);}, {view,basis});
      await page.waitForTimeout(700); await page.evaluate(()=>window.__focusQA.stop());
      const points=await page.evaluate(()=>window.__focusQA.points()); if(!points.length)throw new Error('No visible 2D points');
      const p=points[Math.floor(points.length/2)];
      const before=await page.evaluate(()=>window.__focusQA.count2d());
      await page.mouse.move(p.x,p.y); await page.waitForTimeout(80);
      const hover=await page.evaluate(()=>({count:window.__focusQA.count2d(),state:window.__focusQA.state}));
      if(!hover.state.hovered || before!==hover.count)throw new Error('2D hover changes edges: '+view+basis);
      await page.mouse.click(p.x,p.y);
      const click=await page.evaluate(()=>({count:window.__focusQA.count2d(),state:window.__focusQA.state}));
      if(!click.state.selected||click.count>=before)throw new Error('2D click not focused: '+view+basis);
      await page.mouse.move(100,80);
      if(await page.evaluate(()=>window.__focusQA.count2d())!==click.count)throw new Error('2D leave changes selection');
      await page.evaluate(()=>{window.__focusQA.clearCurrentNodeSelection();window.__focusQA.renderOverview();window.__focusQA.render();});
      if(await page.evaluate(()=>window.__focusQA.count2d())!==before)throw new Error('2D clear not restored');
      await page.evaluate(()=>window.__focusQA.setRenderMode('3d')); await page.waitForFunction(()=>window.__focusQA.ready && !document.querySelector('#graph-3d-status').classList.contains('error'));
      await page.waitForTimeout(900);
      const three=await page.evaluate(()=>{
        const q=window.__focusQA,g=q.graph,data=g.graphData(), n=data.nodes[0],other=data.nodes[1];
        const count=()=>data.links.filter(g.linkVisibility()).length;
        const all=count();g.onNodeHover()(n);const hover=count();g.onNodeClick()(n);const clicked=count();g.onNodeHover()(other);const otherHover=count();g.onNodeHover()(null);const leave=count();g.onNodeClick()(n);return{all,hover,clicked,otherHover,leave,cleared:count()};
      });
      if(three.all!==three.hover||three.clicked>=three.all||three.otherHover!==three.clicked||three.leave!==three.clicked||three.cleared!==three.all)throw new Error('3D focus mismatch '+JSON.stringify(three));
      results.push({view,basis,two:{all:before,clicked:click.count},three});
    }
    const legends=await page.evaluate(()=>{
      const a=document.querySelector('#graph-3d-keys'),b=document.querySelector('.graph-legend'),r=a.getBoundingClientRect(),s=b.getBoundingClientRect(),ca=getComputedStyle(a),cb=getComputedStyle(b);
      return{gap:s.left-r.right,bottomDifference:Math.abs(r.bottom-s.bottom),topDifference:Math.abs(r.top-s.top),sameStyle:['backgroundColor','borderRadius','fontSize','boxShadow'].every(k=>ca[k]===cb[k])};
    });
    if(legends.gap<0||legends.bottomDifference>1||!legends.sameStyle)throw new Error('Legend mismatch '+JSON.stringify(legends));
    await page.screenshot({path:'output/playwright/3d-legends-aligned.png'});
    await page.getByRole('button',{name:'切换到夜间模式',exact:true}).click();
    await page.screenshot({path:'output/playwright/3d-legends-dark.png'});
    return{verified:'window logos, placeholder, composer alignment, eight graph combinations, hover/click/clear, aligned matching legends',legends,results};
  } finally {
    await page.unroute(routePattern,inject);
    await page.evaluate(saved=>{localStorage.clear();Object.entries(saved).forEach(([k,v])=>localStorage.setItem(k,v));},backup);
    await page.reload();
  }
}
