import test from 'node:test';
import assert from 'node:assert/strict';
import {chunkDocument} from './research-evidence.js';
test('Chinese paragraphs split at punctuation without requiring whitespace',()=>{
 const sentence='这是一个有明确语义边界的完整句子。',markdown=sentence.repeat(160),chunks=chunkDocument({markdown},{id:'zh'});
 assert.ok(chunks.length>1);assert.ok(chunks.every(c=>c.text.length<=1400&&c.text.endsWith('。')));
 assert.equal(chunks.map(c=>c.text).join(''),markdown);
});
