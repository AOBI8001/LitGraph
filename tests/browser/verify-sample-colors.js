async page => {
 const pattern='**/src/main.js*';
 const inject=async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nwindow.__colorQA={sample(){activateProjectData(createSampleProject(), SAMPLE_PROJECT_ID)},setView,setRenderMode,setLayoutBasis,nodeFill,get graph(){return graph3d},get nodes(){return nodes}};'});};
 const failures=[];const report=[];const errorHandler=e=>failures.push(e.message);
 page.on('pageerror',errorHandler);
 try {
  await page.route(pattern,inject);await page.reload();await page.waitForFunction(()=>window.__colorQA);
  await page.evaluate(()=>window.__colorQA.sample());
  for(const view of ['semantic','timeline'])for(const basis of ['argument','semantic']){
   await page.evaluate(({view,basis})=>{const q=window.__colorQA;q.setRenderMode('2d');q.setView(view);q.setLayoutBasis(basis);},{view,basis});
   const colors=await page.evaluate(()=>window.__colorQA.nodes.map(n=>window.__colorQA.nodeFill(n)));
   if(new Set(colors).size<7)throw Error('2D category colors missing');
   if(view==='semantic'&&basis==='argument')await page.screenshot({path:'output/playwright/sample-colors-2d.png'});
   await page.evaluate(()=>window.__colorQA.setRenderMode('3d'));
   await page.waitForFunction(()=>window.__colorQA.graph?.graphData().nodes.length===50&&document.querySelector('#graph-3d-status').hidden);
   const ok=await page.evaluate(()=>{const q=window.__colorQA,g=q.graph;return g.graphData().nodes.every(n=>!n.hasPdf&&g.nodeColor()(n)===q.nodeFill(n))});
   if(!ok)throw Error('3D overrides category color for missing PDFs');
   report.push({view,basis,papers:50,colorVariants:new Set(colors).size});
   if(view==='semantic'&&basis==='argument'){await page.waitForTimeout(1200);await page.screenshot({path:'output/playwright/sample-colors-3d.png'});}
  }
  if(failures.length)throw Error(failures.join('; '));
  return report;
 }finally{page.off('pageerror',errorHandler);await page.unroute(pattern,inject);await page.reload();}
}
