import assert from 'node:assert/strict';
import { RESEARCH_SYSTEM_PROMPT, researchMessages } from './research-agent.js';
const messages = researchMessages([{ id: '1', title: 'Paper', authors: ['A','B'], year: 2020, abstract: 'Evidence', summary: 'Secondary' }], [
  { role: 'user', text: 'Earlier question' }, { role: 'assistant', text: 'Stopped', status: 'paused' },
  { role: 'assistant', text: '无法完成分析：legacy error' }, { role: 'assistant', text: 'Earlier answer', status: 'done' }
], 'Current question');
assert.equal(messages[0].content, RESEARCH_SYSTEM_PROMPT);
const body = JSON.parse(messages[1].content);
assert.deepEqual(body.documents[0].authors, ['A','B']);
assert.equal(body.evidence_level, 'abstracts_and_existing_ai_summaries_only');
assert.equal(body.recent_conversation.length, 2);
assert.equal(body.research_question, 'Current question');
console.log('Research prompt: explicit evidence tier, full author list, scoped documents and clean recent history passed.');
const full = JSON.parse(researchMessages([{ id: '1', title: 'Paper' }], [], 'Question', { evidence: [{ id: 'E1', documentId: '1', sourceKind: 'pdf_text', text: 'Original results', page: 3 }], coverage: [{ id: '1', status: 'fulltext_indexed_excerpts_only' }] })[1].content);
assert.equal(full.evidence_level, 'retrieved_source_excerpts');
assert.equal(full.evidence[0].page, 3);
assert.equal(full.coverage[0].status, 'fulltext_indexed_excerpts_only');
assert.equal(full.response_mode, 'quick');
assert.equal('abstract' in full.documents[0], false);
assert.equal('ai_summary' in full.documents[0], false);
assert.match(RESEARCH_SYSTEM_PROMPT, /【AI 推断】/);
assert.match(RESEARCH_SYSTEM_PROMPT, /without inline evidence IDs/);
const expert = JSON.parse(researchMessages([], [], 'Question', {}, 'expert')[1].content);
assert.equal(expert.response_mode, 'expert');
assert.match(expert.response_guidance, /carefully compare/);
