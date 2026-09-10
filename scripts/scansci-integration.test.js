import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {localService} from './local-service.js';
test('API and MCP share verified records and stored originals; acquisition is cancelable',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'litgraph-scansci-test-'));
 const paper={recordId:'record',doi:'10.1234/test',title:'Fixture',isOpenAccess:true,authors:['A'],year:2024};
 let calls=0,blocked=false;
 const engine={available:()=>true,status:async()=>({available:true}),acquire:async(_paper,signal)=>{signal.throwIfAborted();calls++;if(blocked)await new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});return {bytes:Buffer.from('%PDF-1.4 fixture\n%%EOF'),source:'Fixture'};}};
 const service=localService(root,{engine,scholarly:{search:async()=>({papers:[paper]}),enrich:async p=>p}});
 const server=http.createServer((req,res)=>service(req,res,()=>res.end()));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const call=async(route,data,token)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/__litgraph/${route}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(data)});return {status:response.status,value:await response.json()};};
 try{
  const token=(await call('bootstrap',{})).value.browserToken;
  await call('search',{},token);
  const result=(await call('acquire',{recordId:'record',projectId:'project',nodeId:'first'},token)).value;
  assert.ok(result.data);assert.equal(calls,1);
  assert.match(await readFile(path.join(root,result.originalRelativePath),'utf8'),/%PDF/);
  assert.equal((await call('acquire',{recordId:'invented',projectId:'project',nodeId:'x'},token)).status,400);
  const agent=(await call('instructions',{},token)).value.token;
  const rpc=(name,args={})=>call('agent',{name,arguments:args},agent);
  await rpc('litgraph_connect',{model:'Fixture agent'});
  await call('context',{projectId:'project',papers:[{id:'first',doi:paper.doi},{id:'second',doi:paper.doi}]},token);
  const start=(await rpc('litgraph_acquire_start',{recordId:'record',projectId:'project',nodeId:'first'})).value;
  let state;
  for(let i=0;i<30;i++){state=(await rpc('litgraph_acquire_status',{taskId:start.taskId})).value;if(state.state==='done')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(state.result.originalSaved,true);assert.equal(state.result.data,undefined);assert.equal(state.result.key,result.key);assert.equal(calls,1,'MCP reused API original');
  assert.equal((await rpc('litgraph_acquire_start',{recordId:'record',projectId:'another',nodeId:'first'})).status,400);
  blocked=true;
  const running=(await rpc('litgraph_acquire_start',{recordId:'record',projectId:'project',nodeId:'second'})).value;
  await new Promise(r=>setTimeout(r,20));await rpc('litgraph_acquire_cancel',{taskId:running.taskId});
  const cancellationDeadline=Date.now()+2000;let canceledState;
  do{canceledState=(await rpc('litgraph_acquire_status',{taskId:running.taskId})).value.state;if(canceledState==='cancelled')break;await new Promise(r=>setTimeout(r,20));}while(Date.now()<cancellationDeadline);
  assert.equal(canceledState,'cancelled');
  // Two missing DOI values are not evidence of a paper identity match.
  paper.doi='';await call('context',{projectId:'project',papers:[{id:'unrelated',title:'A different paper'}]},token);
  assert.equal((await rpc('litgraph_acquire_start',{recordId:'record',projectId:'project',nodeId:'unrelated'})).status,400);
 }finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});
test('Acquisitions serialize their source requests, while duplicate documents stay locked',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'litgraph-acquire-concurrency-'));
 const paper={recordId:'r',doi:'10.1234/p',title:'Concurrency fixture',isOpenAccess:true};
 let active=0,peak=0;
 const engine={available:()=>true,acquire:async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,60));active--;return {bytes:Buffer.from('%PDF-1.4 fixture\n%%EOF'),source:'Fixture'};}};
 const service=localService(root,{engine,scholarly:{search:async()=>({papers:[paper]})}});
 const server=http.createServer((req,res)=>service(req,res,()=>res.end()));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let token;
 const call=async(route,data)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/__litgraph/${route}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(data)});return {status:response.status,value:await response.json()};};
 try{
  token=(await call('bootstrap',{})).value.browserToken;await call('search',{});
  const pair=await Promise.all(['a','b'].map(nodeId=>call('acquire',{recordId:'r',projectId:'p',nodeId})));
  assert.equal(peak,1);assert.ok(pair.every(p=>p.status===200&&p.value.data));
  const duplicate=await Promise.all([0,1].map(()=>call('acquire',{recordId:'r',projectId:'p',nodeId:'same'})));
  assert.deepEqual(duplicate.map(p=>p.status).sort(),[200,400]);
 }finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});
test('Institution fallback is invoked once and never reports a truncated PDF as saved',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'litgraph-acquire-institution-'));
 let nativeCalls=0;
 const paper={recordId:'r',doi:'10.1234/p',title:'Institution fixture',isOpenAccess:false};
 const service=localService(root,{engine:{available:()=>true,acquire:async()=>({success:false,status:'needs_access'})},scholarly:{search:async()=>({papers:[paper]})},acquireInstitution:async()=>{nativeCalls++;return {data:Buffer.from('%PDF-1.4 truncated').toString('base64')};}});
 const server=http.createServer((req,res)=>service(req,res,()=>res.end()));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let token;
 const call=async(route,data)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/__litgraph/${route}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(data)});return {status:response.status,value:await response.json()};};
 try{
  token=(await call('bootstrap',{})).value.browserToken;await call('search',{});
  const result=await call('acquire',{recordId:'r',projectId:'p',nodeId:'a',source:'institution',portalUrl:'https://library.example.edu/'});
  assert.equal(nativeCalls,1);assert.equal(result.status,400);assert.match(result.value.error,/incomplete PDF/);
  const record=(await call('document-state',{projectId:'p',nodeId:'a'})).value;
  assert.equal(record.originalRelativePath,undefined);
 }finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});

test('Institution verification holds all subsequent source requests until resume',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'litgraph-verification-queue-'));
 const paper={recordId:'r',doi:'10.1234/wait',title:'Verification fixture',isOpenAccess:false};
 let calls=0,resume,waiting=false;
 const service=localService(root,{
   engine:{acquire:async()=>{calls++;return {success:false};}},
   scholarly:{search:async()=>({papers:[paper]})},
   acquireInstitution:async(_input,signal)=>{
     waiting=true;
     await new Promise((resolve,reject)=>{resume=resolve;signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});
     return {data:Buffer.from('%PDF-1.4 fixture\n%%EOF').toString('base64')};
   }
 });
 const server=http.createServer((req,res)=>service(req,res,()=>res.end()));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const call=async(route,data,token)=>{
   const response=await fetch('http://127.0.0.1:'+server.address().port+'/__litgraph/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(data)});
   return {status:response.status,value:await response.json()};
 };
 try{
   const one=(await call('bootstrap',{})).value.browserToken;
   const two=(await call('bootstrap',{})).value.browserToken;
   await call('search',{},one);await call('search',{},two);
   const first=call('acquire',{recordId:'r',projectId:'p',nodeId:'a',source:'institution'},one);
   for(let i=0;i<100&&!waiting;i++)await new Promise(r=>setTimeout(r,10));
   assert.equal(waiting,true);
   const second=call('acquire',{recordId:'r',projectId:'p',nodeId:'b',source:'open'},two);
   await new Promise(r=>setTimeout(r,100));assert.equal(calls,1);
   resume();
   assert.equal((await first).value.type,'application/pdf');
   await second;assert.equal(calls,2);
 }finally{resume?.();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});

test('Cancelling a queued acquisition settles promptly without releasing the authentication barrier',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'litgraph-verification-cancel-'));
 const paper={recordId:'r',doi:'10.1234/wait',title:'Verification cancellation fixture',isOpenAccess:false};
 const pdf=Buffer.from('%PDF-1.4 fixture\n%%EOF');
 let calls=0,resume,waiting=false,first;
 const service=localService(root,{
   engine:{available:()=>true,acquire:async()=>{calls++;return calls===1?{success:false}:{bytes:pdf,source:'Fixture'};}},
   scholarly:{search:async()=>({papers:[paper]})},
   acquireInstitution:async(_input,signal)=>{
     waiting=true;
     await new Promise((resolve,reject)=>{
       const abort=()=>reject(signal.reason);
       signal.addEventListener('abort',abort,{once:true});
       resume=()=>{signal.removeEventListener('abort',abort);resolve();};
     });
     return {data:pdf.toString('base64')};
   }
 });
 const server=http.createServer((req,res)=>service(req,res,()=>res.end()));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const call=async(route,data,token)=>{
   const response=await fetch('http://127.0.0.1:'+server.address().port+'/__litgraph/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(data)});
   return {status:response.status,value:await response.json()};
 };
 try{
   const firstClient=(await call('bootstrap',{})).value.browserToken;
   const queuedClient=(await call('bootstrap',{})).value.browserToken;
   await call('search',{},firstClient);await call('search',{},queuedClient);
   const agentToken=(await call('instructions',{},queuedClient)).value.token;
   const rpc=(name,args={})=>call('agent',{name,arguments:args},agentToken);
   await rpc('litgraph_connect',{model:'Fixture agent'});
   await call('context',{projectId:'p',papers:[{id:'cancelled',doi:paper.doi},{id:'third',doi:paper.doi}]},queuedClient);
   first=call('acquire',{recordId:'r',projectId:'p',nodeId:'first',source:'institution'},firstClient);
   const waitDeadline=Date.now()+2000;
   while(!waiting&&Date.now()<waitDeadline)await new Promise(r=>setTimeout(r,10));
   assert.equal(waiting,true,'The predecessor must be waiting for institution authentication');

   const queued=await rpc('litgraph_acquire_start',{recordId:'r',projectId:'p',nodeId:'cancelled',source:'open'});
   assert.equal(queued.status,200);assert.ok(queued.value.taskId);
   assert.equal(calls,1,'Queued work must not start a source request');
   await rpc('litgraph_acquire_cancel',{taskId:queued.value.taskId});
   const cancelledDeadline=Date.now()+1000;
   let cancelled;
   do{
     cancelled=(await rpc('litgraph_acquire_status',{taskId:queued.value.taskId})).value;
     if(cancelled.state==='cancelled')break;
     await new Promise(r=>setTimeout(r,10));
   }while(Date.now()<cancelledDeadline);
   assert.equal(cancelled.state,'cancelled','Cancellation must settle while the predecessor is still awaiting authentication');
   assert.equal((await call('document-state',{projectId:'p',nodeId:'cancelled'},queuedClient)).value,null,'Cancelled queued work must not create a document');

   const third=await rpc('litgraph_acquire_start',{recordId:'r',projectId:'p',nodeId:'third',source:'open'});
   assert.equal(third.status,200);assert.ok(third.value.taskId,'Cancellation must free this client’s active-task slot');
   await new Promise(r=>setTimeout(r,100));
   assert.equal(calls,1,'Cancelling a queue slot must not allow later work to bypass the authentication barrier');
   assert.equal((await rpc('litgraph_acquire_status',{taskId:third.value.taskId})).value.state,'processing');

   resume();assert.equal((await first).value.type,'application/pdf');
   const completionDeadline=Date.now()+2000;
   let completed;
   do{
     completed=(await rpc('litgraph_acquire_status',{taskId:third.value.taskId})).value;
     if(completed.state==='done')break;
     await new Promise(r=>setTimeout(r,10));
   }while(Date.now()<completionDeadline);
   assert.equal(completed.state,'done');assert.equal(completed.result.originalSaved,true);
   assert.equal(calls,2,'Only the predecessor and the third request may reach a source');
 }finally{resume?.();await first?.catch(()=>{});await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});

test('Institution search uses saved browser results, enriches exact titles and retains closed records',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'litgraph-institution-search-'));
 const title='Exact Full Paper Title', query={originalQuery:title,filters:{source:'institution',yearStart:2000,yearEnd:2030,language:'any',articleType:'any',resultCount:5}};
 let browserCalls=0,lookups=0;
 const service=localService(root,{
   searchInstitution:async input=>{browserCalls++;assert.equal(input.originalQuery,title);return {sourceUrl:'https://publisher.example/search?q=exact',papers:[{title,sourceUrl:'https://publisher.example/article/1'}]};},
   scholarly:{search:async()=>{throw Error('Institution results must not be replaced by public search');},lookup:async input=>{lookups++;assert.equal(input.title,title);return {title,authors:['Author'],year:2024,doi:'10.1234/test',sourceUrl:'https://doi.org/10.1234/test',isOpenAccess:false};}}
 });
 const server=http.createServer((req,res)=>service(req,res,()=>res.end()));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const call=async(route,data,token)=>{const response=await fetch('http://127.0.0.1:'+server.address().port+'/__litgraph/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(data)});return {status:response.status,value:await response.json()};};
 try{
  const token=(await call('bootstrap',{})).value.browserToken;
  const result=await call('search',query,token);
  assert.equal(result.status,200);assert.equal(browserCalls,1);assert.equal(lookups,1);
  assert.equal(result.value.papers[0].exactTitleMatch,true);
  assert.equal(result.value.papers[0].sourceUrl,'https://publisher.example/article/1');
  assert.equal(result.value.papers[0].isOpenAccess,false);
 }finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});

async function withInstitutionService(dependencies,run){
 const root=await mkdtemp(path.join(tmpdir(),'litgraph-institution-records-'));
 const service=localService(root,dependencies),server=http.createServer((req,res)=>service(req,res,()=>res.end()));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let token;
 const call=async(route,data,authorization=token)=>{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/__litgraph/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+authorization},body:JSON.stringify(data)});
  return {status:response.status,value:await response.json()};
 };
 try{token=(await call('bootstrap',{})).value.browserToken;await run(call);}
 finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
}
const institutionFilters={source:'institution',yearStart:2020,yearEnd:2026,language:'any',articleType:'any',resultCount:5,sort:'comprehensive'};
test('Institution records survive unavailable public metadata and retain unknown citation counts',async()=>{
 const title='Online impulsive buying in social commerce: A mixed-methods research';
 const sourceUrl='https://library.example.edu/discovery/fulldisplay?docid=cdi_webofscience_primary_001199054400001CitationCount';
 let publicSearches=0;
 await withInstitutionService({
  searchInstitution:async()=>({sourceUrl:'https://library.example.edu/discovery/search?query='+encodeURIComponent(title),diagnostics:{platform:'primo',resultsRecognized:true},papers:[{title,sourceUrl,year:2024,authors:['Haiqin Xu','Xiang Gong','Ruihe Yan'],doi:'10.1016/j.im.2024.103943',fullTextUrl:sourceUrl+'&context=PC'}]}),
  scholarly:{search:async()=>{publicSearches++;throw Error('Wrong transport');},lookup:async()=>{throw Error('Metadata source unavailable');}}
 },async call=>{
  const result=await call('search',{originalQuery:title,filters:institutionFilters});
  assert.equal(result.status,200);assert.equal(publicSearches,0);assert.equal(result.value.papers.length,1);
  const paper=result.value.papers[0];
  assert.equal(paper.title,title);assert.equal(paper.doi,'10.1016/j.im.2024.103943');assert.equal(paper.sourceUrl,sourceUrl);
  assert.equal(paper.citations,null);assert.equal(paper.isOpenAccess,null);assert.equal(paper.citationSource,'');
  assert.equal(paper.metadataVerification,'source-observed');assert.equal(paper.metadataSource,'Institution browser');
  assert.equal(paper.sourceRecord.url,sourceUrl);assert.equal(paper.exactTitleMatch,true);
  assert.deepEqual(paper.authors,['Haiqin Xu','Xiang Gong','Ruihe Yan']);
  assert.equal(result.value.diagnostics.sourceOnly,1);assert.equal(result.value.diagnostics.browser.platform,'primo');
  assert.match(result.value.warnings.join(' '),/counts remain unknown/);
 });
});
test('Institution enrichment preserves authenticated record and full-text routes through acquisition',async()=>{
 const title='A mixed–methods study: Learning & memory',recordUrl='https://gateway.example.edu/discovery/fulldisplay?docid=recordCitationCount';
 const fullTextUrl='https://gateway.example.edu/openurl?sid=primo&doi=10.1234%2Fmemory',pdfUrl='https://publisher-com.gateway.example.edu/doi/pdf/10.1234/memory';
 let nativeInput,acquisitionMetadata;
 await withInstitutionService({
  searchInstitution:async()=>({sourceUrl:'https://gateway.example.edu/discovery/search',diagnostics:{partial:true,warning:'The institution page is waiting for verification.'},papers:[{title,sourceUrl:recordUrl,doi:'10.1234/memory',year:2024,fulltextUrl:fullTextUrl,pdfUrl,pdfUrls:['javascript:bad()',pdfUrl],fullTextUrls:['file:///secret'] }]}),
  scholarly:{lookup:async()=>({title:'A mixed-methods study: learning & memory.',doi:'10.1234/memory',authors:['One','Two'],year:2024,citations:9,metadataSource:'Crossref',citationSource:'Crossref',isOpenAccess:false,sourceUrl:'https://doi.org/10.1234/memory'})},
  engine:{available:()=>true,acquire:async paper=>{acquisitionMetadata=paper;return {success:false,metadata:{...paper,sourceUrl:'https://publisher.example/article/memory',institutionRecordUrl:'https://publisher.example/replaced'}};}},
  acquireInstitution:async input=>{nativeInput=input;return {data:Buffer.from('%PDF-1.4 fixture\n%%EOF').toString('base64'),sourceUrl:pdfUrl};}
 },async call=>{
  const result=(await call('search',{originalQuery:title,filters:institutionFilters})).value,found=result.papers[0];
  assert.equal(result.incomplete,true);assert.ok(result.warnings.includes('The institution page is waiting for verification.'));
  assert.equal(found.metadataVerification,'metadata-enriched');assert.equal(found.citations,9);assert.equal(found.sourceUrl,recordUrl);
  assert.deepEqual(found.institutionPdfUrls,[pdfUrl]);assert.deepEqual(found.institutionFullTextUrls,[fullTextUrl]);
  assert.equal(found.pdfUrl,undefined,'An authenticated PDF must not be mislabeled an open-access PDF');
  const acquired=await call('acquire',{recordId:found.recordId,projectId:'project',nodeId:'paper',source:'institution'});
  assert.equal(acquired.status,200);assert.ok(acquired.value.data);
  assert.equal(acquisitionMetadata.sourceUrl,recordUrl);assert.equal(nativeInput.url,recordUrl);
  assert.equal(nativeInput.institutionRecordUrl,recordUrl);assert.deepEqual(nativeInput.institutionPdfUrls,[pdfUrl]);
  assert.deepEqual(nativeInput.institutionFullTextUrls,[fullTextUrl]);assert.equal(nativeInput.institutionSearchUrl,'https://gateway.example.edu/discovery/search');
  assert.equal(acquired.value.metadata.sourceUrl,recordUrl);
 });
});
test('Conflicting enrichment cannot replace a real institution record or introduce another paper DOI',async()=>{
 const papers=[{title:'Shared title with different editions',doi:'10.1234/observed',year:2024,sourceUrl:'https://library.example.edu/record/one'},
  {title:'Second observed title',year:2023,sourceUrl:'https://library.example.edu/record/two'}];
 await withInstitutionService({
  searchInstitution:async()=>({sourceUrl:'https://library.example.edu/search',papers}),
  scholarly:{lookup:async input=>({title:input.doi?input.title:'Completely unrelated title',doi:'10.1234/wrong',authors:['Unrelated author'],year:2025,citations:9000,sourceUrl:'https://publisher.example/wrong'})}
 },async call=>{
  const result=(await call('search',{originalQuery:papers[0].title,filters:institutionFilters})).value;
  assert.equal(result.papers.length,2);assert.equal(result.diagnostics.identityConflicts,2);
  assert.equal(result.papers[0].doi,'10.1234/observed');assert.equal(result.papers[1].doi,'');
  for(const paper of result.papers){assert.equal(paper.citations,null);assert.deepEqual(paper.authors,[]);assert.equal(paper.metadataVerification,'source-observed');}
  assert.match(result.warnings.join(' '),/different paper was ignored/);
 });
});
test('Institution result filters explain missing metadata, exclusions and duplicates without requiring OA',async()=>{
 const paper=(title,fields={})=>({title,sourceUrl:'https://library.example.edu/record/'+encodeURIComponent(title),year:2024,language:'en',articleType:'research',...fields});
 const records=[paper('Accepted closed paper',{isOpenAccess:false}),paper('Duplicate',{doi:'10.1234/duplicate'}),paper('Duplicate',{doi:'10.1234/duplicate'}),paper('Already in project'),
  paper('Wrong year',{year:2019}),paper('Wrong language',{language:'zh'}),paper('Wrong type',{articleType:'review'}),paper('Unknown year',{year:null}),paper('Unknown language',{language:'unknown'}),paper('Unknown type',{articleType:'unknown'})];
 await withInstitutionService({searchInstitution:async()=>({sourceUrl:'https://library.example.edu/search',papers:records}),scholarly:{}},async call=>{
  const result=(await call('search',{originalQuery:'Accepted closed paper',filters:{...institutionFilters,language:'en',articleType:'research'},exclude:['alreadyinproject']})).value;
  assert.equal(result.papers.length,2);assert.equal(result.papers[0].isOpenAccess,false);
  assert.equal(result.diagnostics.duplicates,1);assert.equal(result.diagnostics.excluded,1);
  assert.deepEqual(result.diagnostics.filtered,{year:1,language:1,articleType:1,unknownYear:1,unknownLanguage:1,unknownType:1});
  assert.match(result.warnings.join(' '),/selected filters/);
 });
});
test('Institution source language and explicit publication-type labels normalize to filter values',async()=>{
 const papers=[{title:'Research from the publisher',sourceUrl:'https://publisher.example/article/research',year:2024,language:'en-US',type:'Research Article'},
  {title:'Review from the publisher',sourceUrl:'https://publisher.example/article/review',year:2024,language:'English',type:'Review Article'}];
 await withInstitutionService({searchInstitution:async()=>({sourceUrl:'https://publisher.example/search',papers}),scholarly:{}},async call=>{
  const result=(await call('search',{originalQuery:'Research from the publisher',filters:{...institutionFilters,language:'en',articleType:'research'}})).value;
  assert.equal(result.papers.length,1);assert.equal(result.papers[0].language,'en');assert.equal(result.papers[0].articleType,'research');
  assert.equal(result.diagnostics.filtered.articleType,1);
 });
});
test('MCP institution search shares source-observed records and exact-title ordering',async()=>{
 const records=Array.from({length:7},(_,i)=>({title:i===6?'The requested original title':'Other paper '+i,year:2024,sourceUrl:'https://publisher.example/article/'+i}));
 await withInstitutionService({searchInstitution:async()=>({sourceUrl:'https://publisher.example/search',papers:records}),scholarly:{}},async call=>{
  const agentToken=(await call('instructions',{})).value.token;
  await call('agent',{name:'litgraph_connect',arguments:{model:'Fixture agent'}},agentToken);
  const result=await call('agent',{name:'litgraph_scholarly_search',arguments:{originalQuery:'The requested original title',filters:institutionFilters}},agentToken);
  assert.equal(result.status,200);assert.equal(result.value.papers.length,5);assert.equal(result.value.papers[0].title,'The requested original title');
  assert.equal(result.value.papers[0].exactTitleMatch,true);assert.equal(result.value.diagnostics.observed,7);
 });
});
test('Institution search never silently substitutes public search when no native session is available',async()=>{
 let publicSearches=0;
 await withInstitutionService({scholarly:{search:async()=>{publicSearches++;return {papers:[]};}}},async call=>{
  const result=await call('search',{originalQuery:'Requested title',filters:institutionFilters});
  assert.equal(result.status,400);assert.equal(publicSearches,0);assert.match(result.value.error,/authenticated browser session/);
 });
});

test('Combined search queries both channels, deduplicates, ranks and retains authenticated acquisition routes',async()=>{
 const calls=[],common={title:'Exact target paper',doi:'10.1234/joint',year:2024,authors:['Example Author'],language:'en',articleType:'research'};
 const open={...common,recordId:'oa-common',isOpenAccess:true,sourceUrl:'https://publisher.example/joint',citations:12,citationSource:'OpenAlex'};
 const papers=[open,...Array.from({length:4},(_,i)=>({...open,title:'Other paper '+i,doi:'10.1234/other'+i,recordId:'oa-'+i}))];
 let route;
 await withInstitutionService({
  scholarly:{search:async data=>{calls.push(data.filters.source);return {papers,sources:['OpenAlex'],warnings:[],incomplete:false};}},
  engine:{acquire:async()=>({success:false})},
  searchInstitution:async data=>{calls.push(data.filters.source);return {sourceUrl:'https://library.example/search',papers:[{...common,sourceUrl:'https://library.example/record',pdfUrl:'https://library.example/protected.pdf'},{...common,title:'Restricted new paper',doi:'10.1234/restricted',sourceUrl:'https://library.example/restricted',year:2025}],diagnostics:{}};},
  acquireInstitution:async data=>{route=data;return {data:Buffer.from('%PDF-1.4 fixture\n%%EOF').toString('base64')};}
 },async call=>{
  const input={originalQuery:common.title,queries:['one','一个','two','两个'],filters:{...institutionFilters,source:'combined',sort:'combined'}};
  const result=await call('search',input);assert.equal(result.status,200);
  assert.deepEqual(calls,['open','institution'],'A full OA result must not suppress institution search');
  assert.equal(result.value.papers.length,5);assert.equal(result.value.papers[0].doi,common.doi);
  assert.equal(result.value.papers.filter(p=>p.doi===common.doi).length,1);
  assert.equal(result.value.papers[0].institutionRecordUrl,'https://library.example/record');
  assert.deepEqual(result.value.sources,['OpenAlex','Institution browser: library.example']);
  assert.equal(result.value.sourceReports.length,2);
  const acquired=await call('acquire',{recordId:result.value.papers[0].recordId,projectId:'p',nodeId:'n',source:'combined'});
  assert.equal(acquired.status,200);assert.ok(acquired.value.data);assert.equal(route.url,'https://library.example/record');
  const latest=await call('search',{...input,filters:{...input.filters,sort:'newest'}});
  assert.equal(latest.value.papers[0].title,'Restricted new paper');
  const agent=(await call('instructions',{})).value.token;
  await call('agent',{name:'litgraph_connect',arguments:{model:'Fixture'}},agent);
  const mcp=await call('agent',{name:'litgraph_scholarly_search',arguments:input},agent);
  assert.equal(mcp.status,200);assert.equal(mcp.value.papers[0].doi,common.doi);
  assert.deepEqual(mcp.value.sources,['OpenAlex','Institution browser: library.example']);
 });
});
test('Combined search retains successful channel results and exposes failures rather than claiming success',async()=>{
 for(const failed of ['open','institution','both']){
  await withInstitutionService({
   scholarly:{search:async()=>{if(failed!=='institution')throw Error('OA unavailable');return {papers:[],sources:['OpenAlex'],warnings:[],incomplete:true};}},
   searchInstitution:async()=>{if(failed!=='open')throw Error('Session needs sign in');return {sourceUrl:'https://library.example/search',papers:[{title:'Actual institution record',authors:['A'],year:2024,sourceUrl:'https://library.example/p'}]};}
  },async call=>{
   const result=await call('search',{queries:['query'],filters:{...institutionFilters,source:'combined'}});
   if(failed==='both'){assert.equal(result.status,400);return;}
   assert.equal(result.status,200);assert.equal(result.value.sourceReports.find(r=>r.status==='failed').source,failed);
   assert.equal(result.value.incomplete,true);
   assert.deepEqual(result.value.sources,failed==='open'?['Institution browser: library.example']:['OpenAlex']);
  });
 }
});
