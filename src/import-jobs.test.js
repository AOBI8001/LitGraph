import assert from 'node:assert/strict';
import { test } from 'node:test';
import {createImportJob,restoreJobs,processImportItem,processImportBatch,jobCounts,moveTab,setImportCanvasVisibility} from './import-jobs.js';
test('resume analyzes existing MD before retrying broken PDFs and uses the current provider',async()=>{
 const items=[{nodeId:'broken',downloaded:true,converted:false,stage:'error'},{nodeId:'ready',downloaded:true,converted:true,stage:'paused'}],calls=[],signal=new AbortController().signal;
 let provider='codex';
 await processImportBatch(items,(item,stages)=>processImportItem(item,{save(){},reconcile:async()=>{},download:async()=>assert.fail('original already saved'),convert:async()=>{calls.push('convert');throw Error('needs OCR');},analyze:async()=>calls.push(provider)},signal,{stages}),{signal});
 assert.deepEqual(calls,['codex','convert']);assert.equal(items[1].stage,'done');
});
test('stage checkpoint finishes before another stage starts, including pause after response',async()=>{
 const controller=new AbortController(),item={downloaded:true,converted:true};let persisted=false;
 await assert.rejects(processImportItem(item,{save(){},reconcile:async()=>{},analyze:async()=>controller.abort(),checkpoint:async()=>{assert.equal(item.analyzed,true);await Promise.resolve();persisted=true;}},controller.signal));
 assert.equal(persisted,true);assert.equal(item.analyzed,true);
});
test('redraw hides only unfinished import nodes, preserves data and continue restores them',()=>{
 const nodes=[{id:'a',analysisStatus:'done',primaryTheory:'t'},{id:'b',analysisStatus:'pending',primaryTheory:'unclassified'},{id:'other',analysisStatus:'pending'}],job={items:[{nodeId:'a'},{nodeId:'b'}]};
 setImportCanvasVisibility(nodes,job,true);assert.equal(nodes[0].importCanvasHidden,false);assert.equal(nodes[1].importCanvasHidden,true);assert.equal(nodes[2].importCanvasHidden,undefined);assert.equal(nodes.length,3);
 setImportCanvasVisibility(nodes,job,false);assert.equal(nodes[1].importCanvasHidden,false);assert.equal(job.items.length,2);
});
test('pause saves a completed stage and resume does not repeat it',async()=>{
 const job=createImportJob('p','query',{language:'en'}),item={nodeId:'n',stage:'pending'};job.items.push(item);
 let downloads=0,converts=0,analyses=0,saves=0;const controller=new AbortController();
 const steps={save:()=>saves++,reconcile:async()=>{},download:async()=>{downloads++;controller.abort();},convert:async()=>{converts++;},analyze:async()=>{analyses++;}};
 await assert.rejects(processImportItem(item,steps,controller.signal));
 assert.equal(item.downloaded,true);assert.equal(item.stage,'paused');assert.equal(converts,0);
 await processImportItem(item,steps,new AbortController().signal,{wait:async()=>{}});
 assert.deepEqual([downloads,converts,analyses],[1,1,1]);assert.ok(saves>3);assert.equal(jobCounts(job).completed,1);
});
test('analysis failure retains PDF and MD and retry only analyzes',async()=>{
 const item={nodeId:'n'},calls=[];let fail=true;
 const steps={save(){},reconcile:async()=>{},download:async()=>calls.push('PDF'),convert:async()=>calls.push('MD'),analyze:async()=>{calls.push('AI');if(fail)throw Error('provider unavailable');}};
 await processImportItem(item,steps,new AbortController().signal);
 assert.equal(item.stage,'error');assert.equal(item.converted,true);assert.equal(item.error,'provider unavailable');
 fail=false;await processImportItem(item,steps,new AbortController().signal);
 assert.deepEqual(calls,['PDF','MD','AI','AI']);assert.equal(item.stage,'done');assert.equal(item.error,'');
});
test('a failed original is attempted once, then later papers can complete',async()=>{
 const failed={},next={};let downloads=0,converted=0;
 const steps={save(){},reconcile:async()=>{},download:async()=>{downloads++;throw Error('403 access denied');},convert:async()=>converted++,analyze:async()=>{}};
 await processImportItem(failed,steps,new AbortController().signal,{wait:async()=>{}});
 assert.equal(downloads,1);assert.equal(failed.stage,'error');assert.equal(failed.failedStage,'downloading');assert.equal(converted,0);
 await processImportItem(next,{...steps,download:async()=>{}},new AbortController().signal);
 assert.equal(next.stage,'done');assert.equal(converted,1);
});
test('restart restores active jobs as paused; tabs reorder without changing identity/content',()=>{
 const job=createImportJob('p','q',{});job.status='running';
 assert.equal(restoreJobs(JSON.stringify([job]))[0].status,'paused');assert.deepEqual(restoreJobs('bad'),[]);
 const tabs=[{id:'all'},{id:'a',draft:'keep'},{id:'b'}];
 const moved=moveTab(tabs,'a','b',true);assert.deepEqual(moved.map(t=>t.id),['all','b','a']);assert.equal(moved[2],tabs[1]);assert.equal(tabs[1].id,'a');
 assert.equal(moveTab(tabs,'missing','a'),tabs);assert.equal(moveTab(tabs,'a','a'),tabs);
});
test('rolling indexing saves the first MD before later downloads and retains failures',async()=>{
 const items=[{nodeId:'a'},{nodeId:'b'},{nodeId:'c'}],calls=[],signal=new AbortController().signal;
 await processImportBatch(items,(item,stages)=>processImportItem(item,{save(){},reconcile:async()=>{},download:async()=>{calls.push('pdf:'+item.nodeId);},convert:async()=>{calls.push('md:'+item.nodeId);if(item.nodeId==='b')throw Error('broken PDF');},analyze:async()=>{calls.push('ai:'+item.nodeId);assert.ok(items.filter(i=>i.nodeId!=='b').every(i=>i.converted));}},signal,{stages}),{signal,downloadConcurrency:1});
 assert.deepEqual(calls,['pdf:a','md:a','pdf:b','md:b','pdf:c','md:c','ai:a','ai:c']);
 assert.equal(items[0].stage,'done');assert.equal(items[1].stage,'error');assert.equal(items[2].stage,'done');
});
test('OA indexing is bounded to two workers and analysis is sequential after all indexing',async()=>{
 const items=Array.from({length:7},(_,i)=>({nodeId:String(i)})),signal=new AbortController().signal;
 let active=0,peak=0,analyzing=0;
 await processImportBatch(items,async(item,stages)=>processImportItem(item,{save(){},reconcile:async()=>{},download:async()=>{active++;peak=Math.max(active,peak);await new Promise(resolve=>setTimeout(resolve,5));active--;},convert:async()=>{},analyze:async()=>{assert.equal(items.filter(i=>i.converted).length,items.length);assert.equal(analyzing++,0);await new Promise(resolve=>setTimeout(resolve,1));analyzing--; }},signal,{stages}),{signal,downloadConcurrency:20});
 assert.equal(peak,2);assert.ok(items.every(i=>i.stage==='done'));
});
test('pausing waits for active indexing to cancel and never begins analysis',async()=>{
 const items=[{nodeId:'a'},{nodeId:'b'},{nodeId:'c'}],controller=new AbortController(),signal=controller.signal;
 let started=0,finished=0,analyses=0;
 await assert.rejects(processImportBatch(items,async(item,stages)=>processImportItem(item,{save(){},reconcile:async()=>{},download:async()=>{started++;await new Promise(resolve=>setTimeout(resolve,5));if(item.nodeId==='a')controller.abort();finished++;},convert:async()=>{},analyze:async()=>analyses++},signal,{stages}),{signal}));
 assert.equal(started,2);assert.equal(finished,2);assert.equal(analyses,0);assert.equal(items[2].stage,undefined);
 assert.ok(items.slice(0,2).every(i=>i.downloaded&&i.stage==='paused'));
});
