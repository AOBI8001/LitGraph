import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sample from '../src/public-sample.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>readFile(path.join(root,name),'utf8');
const ignore=await read('.gitignore');
for(const entry of ['projects/','output/','.playwright-cli/','versions/','.env','node_modules/','dist/','/README*.md'])
 assert.ok(ignore.split(/\r?\n/).includes(entry),'Missing ignore rule: '+entry);
assert.match(await read('LICENSE'),/MIT License/);
assert.equal(JSON.parse(await read('package.json')).license,'MIT');
assert.equal(sample.nodes.length,50);
const assets=(await readdir(path.join(root,'dist/assets'))).filter(n=>/\.(js|mjs)$/.test(n));
const bundle=(await Promise.all(assets.map(n=>read('dist/assets/'+n)))).join('\n');
assert.ok(bundle.includes('50-paper sample graph'),'Public sample missing');
assert.doesNotMatch(JSON.stringify(sample),/\b[A-Z]:[\\/]|\\Users\\|localTextPath|localPdfPath|apiKey/i);
console.log('Publication checks passed: MIT, 50-paper sample, ignored private files, no known personal paths.');
console.log('Review staged files for secrets before pushing. No Release is created by this check.');
