async page => {
  const backup=await page.evaluate(()=>({...localStorage}));
  const pattern='**/src/main.js*';
  const inject=async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nwindow.__rotationQA={sample(){activateProjectData(createSampleProject(),SAMPLE_PROJECT_ID)},setView,setLayoutBasis,setRenderMode,initialFramingPoints,get graph(){return graph3d},get rotation(){return modelRotation},get pending(){return pendingInitial3dFit}};`});};
  const reports=[];
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  try {
    await page.route(pattern,inject);
    await page.setViewportSize({width:1329,height:958});
    for(const view of ['semantic'])for(const basis of ['semantic','argument']){
      await page.reload();await page.waitForFunction(()=>window.__rotationQA);
      await page.evaluate(({view,basis})=>{const q=window.__rotationQA;q.sample();q.setRenderMode('2d');q.setView(view);q.setLayoutBasis(basis);q.setRenderMode('3d')},{view,basis});
      await page.waitForFunction(()=>window.__rotationQA.graph?.graphData().nodes.length&&!window.__rotationQA.pending&&document.querySelector('#graph-3d-status').hidden);
      await page.waitForTimeout(1500);
      await page.evaluate(()=>window.__rotationQA.graph.cooldownTicks(0));
      await page.waitForTimeout(200);
      const state=()=>page.evaluate(()=>{
        const q=window.__rotationQA,g=q.graph,r=g.scene().children.find(c=>typeof c.graphData==='function');
        const points=q.initialFramingPoints(g.graphData().nodes),center=r.position.clone();
        for(const a of ['x','y','z'])center[a]=(Math.min(...points.map(n=>n[a]))+Math.max(...points.map(n=>n[a])))/2;
        r.updateMatrixWorld(true);r.localToWorld(center);
        const rendered=g.scene().userData.qaRenderedCamera;
        return {eye:rendered?.eye||g.camera().position.toArray(),cameraQ:rendered?.rotation||g.camera().quaternion.toArray(),target:g.controls().target.toArray(),rotation:r.quaternion.toArray(),center:center.toArray(),pivot:q.rotation.pivot.toArray()};
      });
      const before=await state(),b=await page.locator('#graph-3d').boundingBox();
      await page.screenshot({path:`output/playwright/rotation-${view}-${basis}-before.png`});
      const frames=[];
      await page.mouse.move(b.x+35,b.y+45);await page.mouse.down();
      for(const [dx,dy] of [[160,0],[230,80],[80,170],[20,40]]){
        await page.mouse.move(b.x+35+dx,b.y+45+dy,{steps:12});frames.push(await state());
      }
      await page.mouse.up();await page.waitForTimeout(350);frames.push(await state());
      // A second gesture must retain the same pivot, rather than recentering the
      // already-rotated model. Fit/zoom animations must stop at drag start too.
      await page.evaluate(()=>{
        const g=window.__rotationQA.graph,scene=g.scene(),previous=scene.onBeforeRender;
        // Check the pose used to render pixels, not the tween's intermediate
        // mutable camera state after a frame has already been drawn.
        scene.onBeforeRender=function(...args){previous.apply(this,args);scene.userData.qaRenderedCamera={eye:g.camera().position.toArray(),rotation:g.camera().quaternion.toArray()};};
        g.cameraPosition(g.camera().position.clone().multiplyScalar(1.05),g.controls().target.clone(),1000);
      });
      await page.mouse.move(b.x+35,b.y+45);await page.mouse.down();
      await page.waitForTimeout(80); // sample the rendered pose, not an intervening tween callback
      const interrupted=await state();
      await page.mouse.move(b.x+155,b.y+95,{steps:16});
      await page.waitForTimeout(1100);
      const held=await state();await page.mouse.up();
      if(distance(interrupted.eye,held.eye)>1e-6||distance(interrupted.cameraQ,held.cameraQ)>1e-6)throw new Error('Camera animation continued during model drag '+JSON.stringify({view,basis,interrupted,held}));
      if(distance(before.center,held.center)>1e-6)throw new Error('Repeated gesture displaced the main body');
      await page.screenshot({path:`output/playwright/rotation-${view}-${basis}-after.png`});
      reports.push({view,basis,cameraMovement:Math.max(...frames.map(f=>distance(f.eye,before.eye))),cameraTurn:Math.max(...frames.map(f=>distance(f.cameraQ,before.cameraQ))),targetMovement:Math.max(...frames.map(f=>distance(f.target,before.target))),centerDrift:Math.max(...frames.map(f=>distance(f.center,before.center))),modelTurn:Math.max(...frames.map(f=>distance(f.rotation,before.rotation))),pivot:before.pivot,center:before.center});
      const report=reports.at(-1);
      if(report.cameraMovement>1e-6||report.cameraTurn>1e-6||report.targetMovement>1e-6||report.centerDrift>1e-6||report.modelTurn<.01)throw new Error('Model rotation regression: '+JSON.stringify(report));
    }
    return reports;
  }finally{await page.unroute(pattern,inject);await page.evaluate(saved=>{localStorage.clear();Object.entries(saved).forEach(([k,v])=>localStorage.setItem(k,v))},backup);await page.reload();}
}
