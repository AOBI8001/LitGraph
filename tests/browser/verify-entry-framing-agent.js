async page => {
  const backup=await page.evaluate(()=>({...localStorage}));
  const assert=(v,m)=>{if(!v)throw new Error(m)};
  const errors=[];const errorHandler=e=>errors.push(e.message);page.on('pageerror',errorHandler);
  const pattern='**/src/main.js*';
  const inject=async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+`
window.__entryQA={initialFramingPoints,framePerspectiveModel,sample(){activateProjectData(createSampleProject(), SAMPLE_PROJECT_ID)},setView,setRenderMode,setLayoutBasis,createBlankProject,openModal,closeModal,pollExternalAgent,localRequest,externalInstructions,updateModelBadge,get graph(){return graph3d},get pending(){return pendingInitial3dFit},get three(){return graph3dThree},lang(l){language=l;applyLanguage()},fakeAPI(){aiConfig={verified:true,model:'API test',endpoint:'https://not-used.invalid',apiKey:'test'};updateModelBadge()}};`});};
  const report={framing:[]};
  try{
    await page.route(pattern,inject);
    for(const width of [1329,1874])for(const basis of ['argument','semantic']){
      await page.setViewportSize({width,height:958});await page.reload();
      await page.waitForFunction(()=>window.__entryQA);
      await page.evaluate(b=>{const q=window.__entryQA;q.sample();q.setView('semantic');q.setRenderMode('2d');q.setLayoutBasis(b);q.setRenderMode('3d')},basis);
      await page.waitForFunction(()=>window.__entryQA.graph&&window.__entryQA.graph.graphData().nodes.length&&document.querySelector('#graph-3d-status').hidden);
      await page.waitForFunction(()=>!window.__entryQA.pending,{},{timeout:15000});
      await page.waitForTimeout(450);
      const framing=await page.evaluate(()=>{
        const q=window.__entryQA,g=q.graph,c=g.camera();c.updateMatrixWorld();
        const points=g.graphData().nodes.map(n=>new q.three.Vector3(n.x,n.y,n.z).project(c));
        const visible=points.filter(p=>Math.abs(p.x)<.94&&Math.abs(p.y)<.94&&p.z>-1&&p.z<1);
        return {count:points.length,inside:visible.length,occupancy:Math.max(...visible.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)])),bounds:{xmin:Math.min(...visible.map(p=>p.x)),xmax:Math.max(...visible.map(p=>p.x)),ymin:Math.min(...visible.map(p=>p.y)),ymax:Math.max(...visible.map(p=>p.y))},eye:c.position.toArray(),target:g.controls().target.toArray(),model:g.scene().children.find(child=>typeof child.graphData==='function').position.toArray()};
      });
      assert(framing.inside>=Math.ceil(framing.count*.95),'Main model outside initial frame '+JSON.stringify({width,basis,framing}));
      const expected=await page.evaluate(()=>{const q=window.__entryQA,points=q.initialFramingPoints(q.graph.graphData().nodes),fit=q.framePerspectiveModel(points,q.graph.camera(),q.three);return {count:points.length,target:fit.target.toArray(),position:fit.position.toArray()};});
      framing.expected=expected;
      assert(Math.abs(framing.bounds.xmin+framing.bounds.xmax)<.15&&Math.abs(framing.bounds.ymin+framing.bounds.ymax)<.15,'Initial model is not centered');
      if(!(framing.occupancy>.55&&framing.occupancy<.9))await page.screenshot({path:'output/playwright/framing-failure.png'});
      assert(framing.occupancy>.55&&framing.occupancy<.9,'Initial fit too distant/close '+JSON.stringify({width,basis,framing}));
      report.framing.push({width,basis,...framing});
      await page.screenshot({path:'output/playwright/initial-'+width+'-'+basis+'.png'});
      const before=await page.evaluate(()=>{const g=window.__entryQA.graph;return {eye:g.camera().position.toArray(),rotation:g.scene().children.find(c=>typeof c.graphData==='function').quaternion.toArray()}});
      const host=await page.locator('#graph-3d').boundingBox();
      await page.mouse.move(host.x+40,host.y+55);await page.mouse.down();await page.mouse.move(host.x+120,host.y+90,{steps:8});await page.mouse.up();
      const after=await page.evaluate(()=>{const g=window.__entryQA.graph;return {eye:g.camera().position.toArray(),rotation:g.scene().children.find(c=>typeof c.graphData==='function').quaternion.toArray()}});
      assert(Math.hypot(...before.eye.map((v,i)=>v-after.eye[i]))<.001,'Model dragging moved camera');
      assert(Math.hypot(...before.rotation.map((v,i)=>v-after.rotation[i]))>.01,'Model no longer rotates');
    }
    await page.evaluate(()=>{const q=window.__entryQA;q.setRenderMode('2d');q.createBlankProject()});
    const rows=await page.locator('.empty-project-actions button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}));
    assert(rows.length===4&&rows.every((r,i)=>Math.abs(r.x-rows[0].x)<1&&Math.abs(r.width-rows[0].width)<1&&(!i||r.y>rows[i-1].y+rows[i-1].height)),'Rows not aligned');
    await page.screenshot({path:'output/playwright/new-project-rows.png'});
    await page.evaluate(()=>window.__entryQA.openModal('api'));
    assert((await page.locator('#external-agent-label').innerText()).includes('Codex'),'Examples missing');
    await page.screenshot({path:'output/playwright/agent-connection-settings.png'});
    await page.evaluate(()=>window.__entryQA.fakeAPI());
    assert(await page.locator('#agent-connected-dialog').count()===0,'API wrongly triggered agent dialog');
    const handshake=await page.evaluate(async()=>{
      const q=window.__entryQA;
      const instructions=await q.externalInstructions({title:'UI verification',papers:[]},'zh');
      const c=await q.localRequest('instructions',{});
      const r=await fetch('/__litgraph/agent',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.token},body:JSON.stringify({name:'litgraph_connect',arguments:{model:'Codex test agent'}})});
      const result=await r.json();await q.pollExternalAgent();
      return {ok:r.ok,connectionId:!!result.connectionId,noticeInstruction:instructions.includes('接入成功')&&result.instructions.includes('接入成功')};
    });
    assert(handshake.ok&&handshake.connectionId&&handshake.noticeInstruction,'Handshake or instructions missing confirmation');
    await page.locator('#agent-connected-dialog').waitFor({state:'visible'});
    assert((await page.locator('#agent-connected-dialog').innerText()).includes('Codex test agent'),'Connected model missing');
    await page.screenshot({path:'output/playwright/agent-connected-confirmation.png'});
    await page.locator('#agent-connected-dialog button.primary').click();
    await page.evaluate(()=>window.__entryQA.pollExternalAgent());
    assert(await page.locator('#agent-connected-dialog').count()===0,'Repeated polling reopens confirmation');
    await page.evaluate(async()=>{const q=window.__entryQA;await q.localRequest('disconnect',{});await q.pollExternalAgent();q.lang('en')});
    const text=await page.locator('.external-agent-section').innerText();
    assert(!/[\u3400-\u9fff]/.test(text),'English agent section has Chinese');
    report.rows=rows;report.agent={...handshake,apiExcluded:true,oncePerConnection:true,english:true};
    assert(!errors.length,'Browser errors: '+errors.join(';'));return report;
  }finally{
    page.off('pageerror',errorHandler);await page.unroute(pattern,inject);
    await page.evaluate(saved=>{localStorage.clear();Object.entries(saved).forEach(([k,v])=>localStorage.setItem(k,v))},backup);await page.reload();
  }
}
