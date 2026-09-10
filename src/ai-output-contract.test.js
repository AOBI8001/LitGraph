import assert from 'node:assert/strict';
import {RESEARCH_PRESENTATION,SUMMARY_PRESENTATION} from './ai-output-contract.js';
import {researchMessages} from './research-agent.js';
import {paperAnalysisMessages} from './paper-analysis.js';
import {compatibleModelBody,researchThinkingOptions} from './research-mode.js';
assert.ok(researchMessages([],[],'question')[0].content.includes(RESEARCH_PRESENTATION));
assert.ok(paperAnalysisMessages({id:'one'},'source',[],[],'en')[0].content.includes(SUMMARY_PRESENTATION));
for(const model of ['kimi-k3','kimi-k2.6','kimi-k2.7-code']){
 const body=compatibleModelBody({temperature:.2,max_tokens:240},{model},'openai-chat',{connectionTest:true});
 assert.equal(body.temperature,undefined);assert.equal(body.max_tokens,2048);
}
assert.deepEqual(researchThinkingOptions({model:'gpt-6-astra'},'openai-responses','quick'),{reasoning:{effort:'low'}});
assert.deepEqual(researchThinkingOptions({model:'glm-5.3'},'openai-chat','quick'),{thinking:{type:'enabled'},reasoning_effort:'low'});
assert.deepEqual(compatibleModelBody({temperature:.2,max_tokens:200},{model:'custom'},'openai-chat'),{temperature:.2,max_tokens:200});
console.log('Shared Agent/API presentation and documented model parameters passed');
