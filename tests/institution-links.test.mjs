import test from 'node:test';
import assert from 'node:assert/strict';
import {institutionPdfLinks} from '../desktop/institution-links.mjs';

test('institution PDF anchor fallback is visible, unambiguous and metadata-first',()=>{
  const base='https://publisher.example/article/42';
  assert.deepEqual(institutionPdfLinks('<a href="/paper.pdf">Download <b>PDF</b></a>',base),['https://publisher.example/paper.pdf']);
  assert.deepEqual(institutionPdfLinks('<a href="/paper.pdf">PDF 下载</a>',base),['https://publisher.example/paper.pdf']);
  assert.deepEqual(institutionPdfLinks('<a href="/a.pdf">Download PDF</a><a href="/b.pdf">Download PDF</a>',base),[]);
  assert.deepEqual(institutionPdfLinks('<a href="/ref.pdf">A related paper title</a>',base),[]);
  assert.deepEqual(institutionPdfLinks('<a href="/supplement.pdf">Download PDF</a>',base),[]);
  assert.deepEqual(institutionPdfLinks('<meta name="citation_pdf_url" content="/correct.pdf"><a href="/other.pdf">Download PDF</a>',base),['https://publisher.example/correct.pdf']);
  assert.deepEqual(institutionPdfLinks('<a href="javascript:alert(1)">Download PDF</a>',base),[]);
  assert.deepEqual(institutionPdfLinks('<a href="http://127.0.0.1/paper.pdf">Download PDF</a>',base,()=>{throw Error('private address');}),[]);
});
