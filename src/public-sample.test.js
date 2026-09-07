import assert from 'node:assert/strict';
import sample from './public-sample.js';
assert.equal(sample.meta.mock, false);
assert.equal(sample.nodes.length, 50);
const ids = new Set(sample.nodes.map(n => n.id));
assert.equal(ids.size, 50);
assert.deepEqual([...ids], Array.from({length:50},(_,i)=>'paper-'+String(i+1).padStart(3,'0')));
for(const node of sample.nodes) {
 assert.notEqual(node.primaryTheory,'unclassified');
 assert.equal(node.hasPdf,false);
 assert.equal(node.read,false);
 assert.equal(node.pdfUrl,'');
 assert.ok(!node.localTextPath && !node.localPdfPath && !node.localMarkdownPath);
}
for(const edge of [...sample.semanticLinks,...sample.citationLinks]) {
 assert.ok(ids.has(edge.source)); assert.ok(ids.has(edge.target));
}
assert.doesNotMatch(JSON.stringify(sample),/\b[A-Z]:[\\/]|\\Users\\|localTextPath|localPdfPath|apiKey/i);
console.log('50-paper sample: valid graph, no personal paths or bundled originals.');
