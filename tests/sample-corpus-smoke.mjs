// Actual local sample corpus, isolated fresh data directory, no model calls.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { localService } from '../scripts/local-service.js';
import sample from '../src/public-sample.js';
import { withSampleCorpus } from '../src/sample-corpus.js';
import { selectEvidence } from '../src/research-evidence.js';
import { researchMessages } from '../src/research-agent.js';
const root = process.cwd();
await mkdir('output/sample-corpus', {recursive: true});
const dataRoot = await mkdtemp(path.join(root, 'output/sample-corpus/profile-'));
const catalog = JSON.parse(await readFile('dist/sample-fulltext/index.json', 'utf8'));
const project = withSampleCorpus(sample, catalog);
assert.equal(project.meta.fullTextCount, 50);
assert.equal(catalog.uniqueDocumentCount, 49);
const middleware = localService(root, {dataRoot});
const server = http.createServer((req, res) => middleware(req, res, () => {res.statusCode = 404; res.end();}));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/__litgraph/`;
let token;
const call = async (route, body) => {
  const response = await fetch(base + route, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}`}, body: JSON.stringify(body)});
  assert.equal(response.status, 200);
  return response.json();
};
try {
  token = (await call('bootstrap', {})).browserToken;
  const documents = [];
  for (const node of project.nodes) {
    const document = await call('document', {node});
    assert.ok(document?.markdown.length > 5000, node.id);
    assert.equal(document.bundledMarkdown, true);
    assert.equal(document.originalRelativePath, undefined);
    assert.equal(node.hasPdf, false);
    assert.equal(await call('original', {key: document.key}), null);
    assert.equal(await readFile(path.join(dataRoot, document.markdownRelativePath), 'utf8'), document.markdown);
    const evidence = selectEvidence([{node, document}], 'What methods and results are reported?');
    assert.ok(evidence.length && evidence.every(e => e.sourceKind !== 'abstract'), node.id);
    const payload = researchMessages([node], [], 'What methods and results are reported?', {evidence});
    assert.ok(payload.some(message => message.content.includes('fulltext')) || JSON.stringify(payload).includes('source'), node.id);
    documents.push({node, document});
  }
  assert.equal(documents[44].document.key, documents[45].document.key, 'duplicate nodes share canonical original');
  assert.match(documents[27].document.markdown, /Hot and/);
  assert.doesNotMatch(documents[27].document.markdown, /zosteriform/);
  const mismatched = await fetch(base + 'document', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}, body: JSON.stringify({node: {...project.nodes[0], title: 'Different paper'}})});
  assert.equal(mismatched.status, 400);
  const allEvidence = selectEvidence(documents, 'Compare response inhibition and social observation', 28000);
  assert.equal(new Set(allEvidence.map(e => e.documentId)).size, 50);
  assert.equal((await readdir(path.join(dataRoot, 'data/originals'))).length, 0);
  const report = {passed: true, nodesWithMd: 50, uniqueOriginals: 49, pdfFiles: 0,
    evidenceSource: 'original text', allPaperContextCoverage: 50,
    checks: ['fresh profile', 'MD integrity', 'disk persistence', 'no PDF fallback', 'node identity matching', 'single-paper evidence', 'all-paper evidence', 'shared API/Agent request format'],
    limitation: 'Loading/integration checks only. These are not RAG recall, precision or answer accuracy scores.'};
  await writeFile('output/sample-corpus/integration-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
