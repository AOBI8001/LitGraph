import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDurableStorage} from './durable-storage.js';
function cache(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem(k,v){if(v.length>100)throw new DOMException('full','QuotaExceededError');values.set(k,v);},removeItem:k=>values.delete(k)};}
test('large desktop projects survive cache quota and restart',()=>{
 const native=cache(),storage=createDurableStorage(native,{'litgraph.projects.v1':'old'}),large='x'.repeat(100000);
 storage.setItem('litgraph.projects.v1',large);
 assert.equal(storage.getItem('litgraph.projects.v1'),large);
 assert.equal(native.getItem('litgraph.projects.v1'),null);
 const restored=createDurableStorage(cache(),storage.snapshot());
 assert.equal(restored.getItem('litgraph.projects.v1'),large);
 restored.removeItem('litgraph.projects.v1');assert.equal(restored.getItem('litgraph.projects.v1'),null);assert.deepEqual(restored.snapshot(),{});
});
test('state snapshots retain conversations, omit API credentials and ignore foreign keys',()=>{
 const storage=createDurableStorage(cache(),{'litgraph.chat.v2.test':'conversation','litgraph.aiConfig':'secret','other':'foreign'});
 storage.setItem('litgraph.language','en');storage.setItem('other','anything');
 assert.deepEqual(storage.snapshot(),{'litgraph.chat.v2.test':'conversation','litgraph.language':'en'});
 assert.throws(()=>storage.setItem('other','x'.repeat(101)),{name:'QuotaExceededError'});
 storage.clear();assert.equal(storage.getItem('litgraph.aiConfig'),null);assert.deepEqual(storage.snapshot(),{});
});
