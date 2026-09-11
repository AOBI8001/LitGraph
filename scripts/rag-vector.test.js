import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createVectorService} from './rag-vector-service.mjs';
test('local embedding rejects invalid batches and aborts before starting inference',async()=>{
 const embed=createVectorService(path.resolve('output/missing-model-fixture'),path.resolve('output/unused-vector-fixture'));
 for(const [texts,kind]of [[{},'query'],[Array(129).fill('x'),'query'],[['x'.repeat(4001)],'passage'],[['x'],'other']])await assert.rejects(embed(texts,kind),/Invalid/);
 await assert.rejects(embed(['x'],'query',AbortSignal.abort()),/abort/i);
 await assert.rejects(embed(['x'],'query'),/missing/i);
});
