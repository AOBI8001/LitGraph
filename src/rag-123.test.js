import test from 'node:test';
import assert from 'node:assert/strict';
import {chunkDocument} from './research-evidence.js';
import {hybridEvidence} from './research-hybrid.js';
import {createTextStream,partialAnswer} from './ai-stream.js';
import {researchChatKey,withoutResearchData} from './research-scope.js';
import {ResearchRequest} from './research-request.js';
test('short paragraph merge preserves exact source slices and never crosses page/section',()=>{
 const markdown='## PDF Page 1\nMethods\n\n'+Array(40).fill('A short extracted line.').join('\n\n')+'\n## PDF Page 2\nResults\n\nA result.';
 const chunks=chunkDocument({markdown},{id:'paper'});assert.ok(chunks.length<8);for(const c of chunks){assert.equal(c.text,markdown.slice(c.startOffset,c.endOffset));assert.ok(c.text.length<=1400);assert.ok(!c.text.includes('## PDF Page'));}assert.equal(chunks.at(-1).page,2);assert.equal(chunks.at(-1).section,'results');
});
test('a hung dense lookup degrades within its budget, even if transport ignores abort',async()=>{
 const start=performance.now();let stopped=false;
 const result=await hybridEvidence([{node:{id:'a'},document:{markdown:'International students visa requirements.'}}],'visa',{queries:['visa']},{retrievalTimeoutMs:30,searchIndex:(_d,_q,s)=>{s.addEventListener('abort',()=>stopped=true);return new Promise(()=>{});}});
 assert.ok(performance.now()-start<700);assert.equal(stopped,true);assert.equal(result.evidence.length,1);assert.match(result.retrieval.warning,/keyword-only fallback/);
});
test('stream handles split JSON/UTF escapes, multiple providers, and never exposes reasoning',()=>{
 const frames=[{choices:[{delta:{reasoning_content:'SECRET'}}]},{choices:[{delta:{content:'{"answer":"你'}}]},{choices:[{delta:{content:'好\\n证据 [E1]","suggested_followups":[]}'}}]}].map(e=>'data: '+JSON.stringify(e)+'\r\n\r\n').join('');
 const seen=[],s=createTextStream(raw=>seen.push(partialAnswer(raw)));for(const char of frames)s.push(char);assert.equal(partialAnswer(s.finish()),'你好\n证据 [E1]');assert.ok(seen.some(t=>t==='你'));assert.ok(!seen.join('').includes('SECRET'));
 assert.equal(partialAnswer('{"answer":"hello\\u4f'),'hello');assert.equal(partialAnswer('{"answer":"hello\\u4f60'),'hello你');
 for(const e of [{type:'content_block_delta',delta:{type:'text_delta',text:'ok'}},{type:'response.output_text.delta',delta:'ok'}]){const c=createTextStream();c.push('data: '+JSON.stringify(e)+'\n\n');assert.equal(c.finish(),'ok');}
});
test('project keys isolate identical paper IDs; clearing research preserves connection preferences',()=>{
 const tab={type:'paper',nodeIds:['same']};assert.notEqual(researchChatKey('a',tab),researchChatKey('b',tab));
 const state={'litgraph.projects.v1':'private','litgraph.chat.v2.a.paper.same':'private','litgraph.researchTabs.a':'private','litgraph.discoveryHistory.v1':'private','litgraph.activeProjectId':'a','litgraph.aiConfig':'keep','litgraph.language':'zh'};
 state['litgraph.summary.a']='private notes';
 assert.deepEqual(withoutResearchData(state),{'litgraph.aiConfig':'keep','litgraph.language':'zh'});
});
test('cancelled request ignores late stream text and late completions',async()=>{
 let partial,finish;const run=new ResearchRequest(async(_s,_stage,p)=>{partial=p;return new Promise(r=>finish=r);},()=>{});const pending=run.start();partial('first');run.pause();partial('late');finish({answer:'late'});await pending;assert.equal(run.partial,'first');assert.equal(run.status,'paused');
});
