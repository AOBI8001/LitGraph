import assert from 'node:assert/strict';
import test from 'node:test';
import { repairSourceMetadata, bibliographyMessages } from './source-metadata-repair.js';
const title='Comparison of synthetic learning tasks';
const node=()=>({title:title+' 张三',fileName:title+'_张三.pdf',authors:[],year:2026,importedLocally:true,metadataChecked:true,metadataWarning:'no match',sourceMetadataVersion:1});
const document={markdown:`# ${title}_张三.pdf\n## PDF Page 1\n${title}\n张三，李四\n测试大学\n摘要\n测试`};
const applyRemote=(n,m)=>Object.assign(n,m);
test('lookup sees the recovered source title rather than the annotated filename',async()=>{
  const n=node();const seen=[];
  await repairSourceMetadata(n,document,{lookup:async input=>{seen.push(input);return {title,authors:['Source Example'],year:2024,metadataApiUrl:'https://example.org/verified'};},applyRemote,model:()=>assert.fail('complete fields must not trigger a model call')});
  assert.equal(seen.length,1);assert.equal(seen[0].title,title);assert.deepEqual(n.authors,['Source Example']);assert.equal(n.sourceMetadataState.status,'complete');
  await repairSourceMetadata(n,document,{lookup:()=>assert.fail('reuse successful identity'),applyRemote});
  assert.deepEqual(n.authors,['Source Example']);assert.equal(n.metadataOverrides.authors,undefined);
});
test('metadata service failure preserves verified local fields and remains retryable',async()=>{
  const n=node();
  await repairSourceMetadata(n,document,{lookup:async()=>{throw Error('network unavailable');},applyRemote});
  assert.deepEqual(n.authors,['张三','李四']);assert.equal(n.year,null);assert.match(n.metadataWarning,/network unavailable/);assert.equal(n.sourceMetadataState.status,'incomplete');
  let calls=0;await repairSourceMetadata(n,document,{lookup:async()=>{calls++;return {title,year:2023,metadataApiUrl:'https://example.org/verified'};},applyRemote});
  assert.equal(calls,1);assert.equal(n.year,2023);
});
test('model metadata is isolated, bounded to target, and cached for identical source',async()=>{
  const n=node();const doc={markdown:`${title}\nAuthors: not decoded\nAbstract\nSynthetic body`};let calls=0;
  const model=async messages=>{calls++;assert.match(messages[0].content,/TARGET paper/);return {authors:[{name:'Invented Person',quote:'Invented Person'}]};};
  await repairSourceMetadata(n,doc,{model});
  assert.equal(calls,1);assert.deepEqual(n.authors,[]);assert.ok(n.sourceMetadataState.missing.includes('authors'));
  await repairSourceMetadata(n,doc,{model});assert.equal(calls,1,'do not pay again for identical unsuccessful output');
  await repairSourceMetadata(n,{markdown:doc.markdown+'\nChanged source'},{model});assert.equal(calls,2);
});
test('malformed/transient model failures remain retryable and do not abort source preservation',async()=>{
  const n=node();const doc={markdown:`${title}\nAuthors: not decoded\nAbstract\nSynthetic body`};let calls=0;
  const model=async()=>{calls++;throw Error('invalid JSON');};
  await repairSourceMetadata(n,doc,{model});await repairSourceMetadata(n,doc,{model});
  assert.equal(calls,2);assert.match(n.sourceMetadataState.modelError,/invalid JSON/);assert.equal(n.sourceMetadataState.modelAttempt,undefined);assert.equal(n.title,title);
});
test('ambiguous input is not sent to model and cannot donate the first article author',async()=>{
  const n={...node(),title:'hash',fileName:'hash.pdf'};
  const doc={markdown:'First synthetic experiment\nJohn Smith\nTesting University\nAbstract\nBody.\nSecond synthetic experiment\nJane Doe\nTesting University\nAbstract\nBody.'};
  await repairSourceMetadata(n,doc,{model:()=>assert.fail('ambiguous identity must stay unresolved'),lookup:()=>assert.fail('no reliable identity to look up')});
  assert.deepEqual(n.authors,[]);assert.equal(n.sourceMetadataState.identityResolved,false);
});
test('abort propagates instead of being recorded as a metadata failure',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(repairSourceMetadata(node(),document,{signal:controller.signal}),{name:'AbortError'});
});
test('metadata prompt excludes earlier paper text',()=>{
  const source=`Other synthetic experiment\nOther Person\nTesting University\nAbstract\nBody.\n${title}\nJohn Smith\nTesting University\nAbstract\nBody.`;
  const messages=bibliographyMessages({title},source);
  assert.ok(!messages[1].content.includes('Other Person'));assert.ok(messages[1].content.includes('John Smith'));
});
test('changing API/model retries unresolved metadata without storing credentials',async()=>{
  const n=node(),doc={markdown:`${title}\nAuthors: undecoded\nAbstract\nSynthetic body`};let calls=0;
  const model=async()=>{calls++;return {authors:[]};};
  await repairSourceMetadata(n,doc,{model,modelIdentity:'api/model-a'});
  await repairSourceMetadata(n,doc,{model,modelIdentity:'api/model-b'});
  assert.equal(calls,2);assert.ok(!n.sourceMetadataState.modelAttempt.includes('model-b'));
});

test('year-only fallback uses the text model after exact scholarly lookup',async()=>{
  const n=node(),doc={markdown:`${title}\n张三，李四\n测试大学\nVersion of record: 2022\nAbstract\nSynthetic body`},order=[];
  await repairSourceMetadata(n,doc,{lookup:async()=>{order.push('lookup');return null;},applyRemote,model:async()=>{order.push('text-model');return {year:{value:2022,quote:'Version of record: 2022'}};}});
  assert.deepEqual(order,['lookup','text-model']);assert.equal(n.year,2022);assert.equal(n.sourceMetadataState.status,'complete');
});

test('descriptive filename lookup requires exact title AND matching named author',async()=>{
  const make=()=>({title:'合成决策任务的实验研究 张三',fileName:'合成决策任务的实验研究_张三.pdf',importedLocally:true,authors:[]});
  const doc={markdown:'Unreadable or damaged cover text'};
  const n=make();let query;
  await repairSourceMetadata(n,doc,{lookup:async input=>{query=input;return {title:'合成决策任务的实验研究',authors:['张三'],year:2023,metadataApiUrl:'https://example.org/exact'};},applyRemote});
  assert.equal(query.title,'合成决策任务的实验研究');assert.equal(n.sourceMetadataState.status,'complete');
  for(const wrong of [{title:'合成决策任务的实验研究',authors:['李四']},{title:'合成决策任务的其他研究',authors:['张三']}]){
    const n=make();await repairSourceMetadata(n,doc,{lookup:async()=>({...wrong,year:2023}),applyRemote});assert.deepEqual(n.authors,[]);assert.equal(n.year,null);
  }
  await repairSourceMetadata({title:'1234567',fileName:'1234567.pdf',importedLocally:true},doc,{lookup:()=>assert.fail('numeric filename is not a scholarly title')});
});

test('new PDF layout invalidates the text-model cache even if Markdown did not change',async()=>{
  const n=node(),make=text=>({markdown:'same original body',bibliography:{version:1,pages:[{page:1,lines:[{text:title},{text:'Authors: undecoded'},{text},{text:'Abstract'}]}]}});let calls=0;
  const model=async()=>{calls++;return {authors:[]};};
  await repairSourceMetadata(n,make('version one'),{model});await repairSourceMetadata(n,make('version two'),{model});assert.equal(calls,2);
});

test('no-match lookups are cached, transient failures are not, explicit retry may clear the cache',async()=>{
  const n=node();let calls=0;const lookup=async()=>{calls++;return null;};
  await repairSourceMetadata(n,document,{lookup,applyRemote});await repairSourceMetadata(n,document,{lookup,applyRemote});assert.equal(calls,1);
  delete n.sourceMetadataState.lookupAttempt;await repairSourceMetadata(n,document,{lookup,applyRemote});assert.equal(calls,2);
});

test('unparseable model output is retryable instead of cached as an empty valid result',async()=>{
  const n=node(),doc={markdown:`${title}\nAuthors: undecoded\nAbstract\nSynthetic body`};let calls=0;
  const model=async()=>{calls++;return null;};await repairSourceMetadata(n,doc,{model});await repairSourceMetadata(n,doc,{model});
  assert.equal(calls,2);assert.equal(n.sourceMetadataState.modelAttempt,undefined);assert.match(n.sourceMetadataState.modelError,/bibliographic JSON/);
});
