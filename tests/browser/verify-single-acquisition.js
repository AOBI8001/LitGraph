// Synthetic transport-failure regression. Run only on an isolated preview.
// The backend and native calls are mocked; no real institutional login occurs.
async page => {
 const assert=(value,message)=>{if(!value)throw Error(message);};
 const pattern='**/src/main.js*',bridgePattern='**/src/desktop-bridge.js*';
 let httpCalls=0,mode='transport-error';
 const bridge=route=>route.fulfill({contentType:'application/javascript',body:`
  window.__nativeAcquireCalls=0;
  export const desktop={institution:async action=>{if(action==='acquire'){window.__nativeAcquireCalls++;throw Error('Duplicate native acquisition must not occur.');}return [];}};
  export const desktopBootstrap=undefined;
  export const recordUse=()=>{};
  export const modelFetch=(url,options)=>fetch(url,options);
 `});
 const inject=async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`
  window.__singleAcquireQA={get job(){return discoveryHistory[0]},get importing(){return discoveryImporting},async start(){
   createBlankProject();
   const metadata={recordId:'single-acquire-fixture',title:'Synthetic institution transport check',authors:['A Example'],year:2024,doi:'10.1234/single-acquire-fixture',sourceUrl:'https://example.org/paper'};
   const node={...nodeFromScholarlyMetadata(metadata,0),id:'fixture-'+crypto.randomUUID(),discoveryRecordId:metadata.recordId};
   nodes.push(node);project.nodes=nodes;projectIsBlank=false;
   const job=createImportJob(currentProjectId,metadata.title,{source:'institution',institutionUrl:'https://library.example.org'},[metadata]);
   job.items=[{nodeId:node.id,title:node.title,stage:'pending',downloaded:false,converted:false,analyzed:false}];
   discoveryHistory.unshift(job);await runImportJob(job);
  }};`});};
 const acquire=async route=>{
  httpCalls++;
  if(mode==='transport-error')await route.fulfill({status:500,json:{error:'Synthetic backend storage failure after acquisition'}});
  else await route.fulfill({json:{status:'needs_access',institutionAttempted:true,retryable:false,error:'Synthetic institutional session has expired'}});
 };
 try {
  await page.route(pattern,inject);await page.route(bridgePattern,bridge);await page.route('**/__litgraph/acquire',acquire);
  await page.reload();await page.waitForFunction(()=>window.__singleAcquireQA);
  for(const scenario of ['transport-error','institution-expired']){
   mode=scenario;await page.evaluate(()=>window.__singleAcquireQA.start());
   const result=await page.evaluate(()=>({job:window.__singleAcquireQA.job,native:window.__nativeAcquireCalls}));
   assert(result.job.status==='attention'&&result.job.items[0].stage==='error','Acquisition failure incorrectly completed');
   assert(result.job.items[0].attempt===1&&!result.job.items[0].downloaded,'Failed original should be skipped once');
   assert(result.native===0,'Frontend reissued acquisition outside the shared backend after '+scenario);
  }
  assert(httpCalls===2,'Each user import must make exactly one shared acquisition call');
  return {passed:true,httpCalls,nativeRetries:0,checks:['uncertain transport result does not trigger another download','institution failure is not retried through native bridge','failed originals not falsely completed']};
 } finally {
  await page.unroute(pattern,inject);await page.unroute(bridgePattern,bridge);await page.unroute('**/__litgraph/acquire',acquire);await page.reload();
 }
}
