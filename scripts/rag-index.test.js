import test from 'node:test';
import assert from 'node:assert/strict';
import {createRagIndex} from './rag-index.mjs';
import {fingerprint} from '../src/research-evidence.js';
const waitFor=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('index did not finish');};
test('index builds before queries, resumes checkpoints, invalidates changed MD and isolates scopes',async()=>{
 const records={a:{markdown:Array(90).fill('Methods contain evidence.').join('\n\n')},b:{markdown:'Other project private evidence.'}},disk=new Map();let passages=0;
 const config={embed:async(texts,kind)=>{if(kind==='passage')passages+=texts.length;return texts.map(()=>Array(384).fill(1/Math.sqrt(384)));},readRecord:async key=>records[key],readIndex:async key=>structuredClone(disk.get(key)),writeIndex:async(k,v)=>disk.set(k,structuredClone(v)),yieldWork:()=>new Promise(r=>setTimeout(r,0))};
 const index=createRagIndex(config);index.control('pause');index.enqueue('a',{id:'same'});assert.equal(index.status().queued,1);assert.equal(passages,0);index.control('resume');await waitFor(()=>index.status().ready===1);const first=passages;
 const search=await index.search([{key:'a',id:'same',hash:fingerprint(records.a.markdown)}],['evidence']);assert.ok(search.indexedChunks>0);assert.equal(passages,first);
 assert.equal((await index.search([{key:'a',id:'other',hash:fingerprint(records.a.markdown)}],['evidence'])).indexedChunks,0);
 index.close();const restarted=createRagIndex(config);restarted.enqueue('a',{id:'same'});await waitFor(()=>restarted.status().ready===1);assert.equal(passages,first);
 records.a.markdown+='\n\nNew evidence.';restarted.enqueue('a',{id:'same'},{changed:true});await waitFor(()=>restarted.status().ready===1);assert.ok(passages>first);restarted.close();
});
test('background failures are visible and retryable',async()=>{
 let fail=true;const index=createRagIndex({embed:async()=>{if(fail)throw Error('test');return [Array(384).fill(0)];},readRecord:async()=>({markdown:'test text'}),readIndex:async()=>null,writeIndex:async()=>{},yieldWork:()=>Promise.resolve()});index.enqueue('a',{id:'a'});await waitFor(()=>index.status().failed===1);fail=false;index.control('retry');await waitFor(()=>index.status().ready===1);index.close();
});
