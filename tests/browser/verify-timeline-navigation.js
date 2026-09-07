async page => {
  const backup=await page.evaluate(()=>({...localStorage})),pattern='**/src/main.js*';
  const inject=async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nwindow.__timelineQA={sample(){activateProjectData(createSampleProject(),SAMPLE_PROJECT_ID)},setView,setLayoutBasis,setRenderMode,closeInspectorPanel,get graph(){return graph3d},get guides(){return graph3dYearGuideGroup},lang(l){language=l;applyLanguage()}};`});};
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  const report=[];
  try{
    await page.route(pattern,inject);await page.setViewportSize({width:1329,height:958});
    for(const basis of ['argument','semantic']){
      await page.reload();await page.waitForFunction(()=>window.__timelineQA);
      await page.evaluate(basis=>{const q=window.__timelineQA;q.sample();q.setRenderMode('2d');q.setView('timeline');q.setLayoutBasis(basis);q.setRenderMode('3d')},basis);
      await page.waitForFunction(()=>window.__timelineQA.graph?.graphData().nodes.length&&document.querySelector('#graph-3d-status').hidden);
      await page.waitForTimeout(1500);await page.evaluate(()=>window.__timelineQA.graph.cooldownTicks(0));await page.waitForTimeout(200);
      const state=()=>page.evaluate(()=>{const q=window.__timelineQA,g=q.graph,root=g.scene().children.find(c=>typeof c.graphData==='function');return {eye:g.camera().position.toArray(),target:g.controls().target.toArray(),cameraQ:g.camera().quaternion.toArray(),root:root.matrixWorld.toArray(),guide:q.guides?.matrixWorld.toArray(),distance:g.camera().position.distanceTo(g.controls().target),roll:g.camera().matrixWorld.elements[1]};});
      const b=await page.locator('#graph-3d').boundingBox();
      const drag=async(button,dx,dy)=>{await page.mouse.move(b.x+35,b.y+45);await page.mouse.down({button});await page.mouse.move(b.x+35+dx,b.y+45+dy,{steps:20});await page.mouse.up({button});await page.waitForTimeout(250);};
      const before=await state();await drag('left',110,70);const pan=await state();
      assert(distance(before.eye,pan.eye)>10,'Pan does not move camera');
      assert(distance(before.cameraQ,pan.cameraQ)<1e-6,'Pan rotates heading');
      assert(distance(pan.eye.map((v,i)=>v-before.eye[i]),pan.target.map((v,i)=>v-before.target[i]))<1e-6,'Eye and target do not translate together');
      assert(distance(before.root,pan.root)<1e-6,'Pan moves model');
      if(before.guide)assert(distance(before.guide,pan.guide)<1e-6,'Pan moves year planes');
      await page.screenshot({path:`output/playwright/timeline-${basis}-pan.png`});
      await drag('right',160,90);const orbit=await state();
      assert(distance(pan.cameraQ,orbit.cameraQ)>.01,'Right drag does not inspect depth');
      assert(distance(pan.root,orbit.root)<1e-6,'Right drag rotates model');
      assert(Math.abs(orbit.roll)<1e-6,'Year axis rolled');
      assert(Math.abs(pan.distance-orbit.distance)<1e-6,'Orbit changes zoom');
      await drag('left',50,30);const repan=await state();assert(distance(orbit.cameraQ,repan.cameraQ)<1e-6,'Pan after orbit rotates camera');
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.wheel(0,-160);await page.waitForTimeout(500);
      const zoom=await state();assert(zoom.distance<repan.distance,'Wheel zoom is broken');
      await page.keyboard.down('w');await page.waitForTimeout(200);await page.keyboard.up('w');const keys=await state();assert(distance(keys.eye,zoom.eye)>1,'WASD navigation is broken');
      const candidates=await page.evaluate(()=>{const g=window.__timelineQA.graph,r=g.scene().children.find(c=>typeof c.graphData==='function'),b=document.querySelector('#graph-3d').getBoundingClientRect();return g.graphData().nodes.map(n=>{const p=r.position.clone().set(n.x,n.y,n.z);r.localToWorld(p);p.project(g.camera());return{x:b.x+(p.x+1)*b.width/2,y:b.y+(1-p.y)*b.height/2,z:p.z};}).filter(p=>p.z>-1&&p.z<1&&p.x>b.x+100&&p.x<b.right-120&&p.y>b.y+70&&p.y<b.bottom-90).sort((a,b)=>a.z-b.z);});
      let picked=false;for(const n of candidates.slice(0,15)){await page.mouse.click(n.x,n.y);await page.waitForTimeout(80);if(await page.locator('#inspector').evaluate(el=>el.classList.contains('open'))){picked=true;break;}}
      assert(picked,'Cannot select nodes after camera navigation');await page.evaluate(()=>window.__timelineQA.closeInspectorPanel());
      await page.evaluate(()=>window.__timelineQA.lang('en'));assert(!/[\u3400-\u9fff]/.test(await page.locator('#graph-3d-keys').innerText()),'English hint not translated');
      await page.screenshot({path:`output/playwright/timeline-${basis}-orbit.png`});
      report.push({basis,pan:true,modelFixed:true,yearPlanesFixed:true,boundedOrbit:true,noRoll:true,zoom:true,keyboard:true,nodePicking:true});
    }
    return report;
  }finally{await page.unroute(pattern,inject);await page.evaluate(saved=>{localStorage.clear();Object.entries(saved).forEach(([k,v])=>localStorage.setItem(k,v))},backup);await page.reload();}
}
