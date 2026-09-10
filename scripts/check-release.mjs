import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sample from '../src/public-sample.js';
import { execFileSync } from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>readFile(path.join(root,name),'utf8');
const ignore=await read('.gitignore');
for(const entry of ['projects/','data/','output/','.playwright-cli/','versions/','.env','node_modules/','dist/','*.local.json','release/'])
 assert.ok(ignore.split(/\r?\n/).includes(entry),'Missing ignore rule: '+entry);
assert.match(await read('LICENSE'),/MIT License/);
assert.equal(JSON.parse(await read('package.json')).license,'MIT');
assert.equal(sample.nodes.length,50);
const assets=(await readdir(path.join(root,'dist/assets'))).filter(n=>/\.(js|mjs)$/.test(n));
const bundle=(await Promise.all(assets.map(n=>read('dist/assets/'+n)))).join('\n');
assert.ok(bundle.includes('50-paper sample graph'),'Public sample missing');
assert.doesNotMatch(JSON.stringify(sample),/\b[A-Z]:[\\/]|\\Users\\|localTextPath|localPdfPath|apiKey/i);
const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const secrets=await read('output/metrics-admin.local.json').then(JSON.parse).catch(()=>({}));
for(const file of tracked){
 assert.doesNotMatch(file,/^(?:projects|data|output|release|node_modules)\/|\.local\.json$|\.env$/,'Private path tracked');
 const bytes=await readFile(path.join(root,file));
 for(const secret of Object.values(secrets))if(typeof secret==='string'&&secret.length>20)assert.ok(!bytes.includes(Buffer.from(secret)),'Operator secret in tracked file: '+file);
 if(/\.(?:js|mjs|cjs|md|json)$/.test(file))assert.doesNotMatch(bytes.toString(),/sk-[a-zA-Z0-9_-]{30,}|gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{30,}/,'Potential credential in '+file);
}
for(const file of ['README.md','README.en.md']){
 const markdown=await read(file);
 assert.ok(markdown.includes(JSON.parse(await read('package.json')).version),'README version must match package.json');assert.match(markdown,/5.*10.*20.*50.*100/);
 for(const match of markdown.matchAll(/\]\(([^\s)]+)\)/g))if(!/^https?:|^#/.test(match[1]))await readFile(path.join(root,match[1].split('#')[0]));
}
console.log('Publication checks passed: MIT, 50-paper sample, ignored private files, no known personal paths.');
console.log('Review staged files for secrets before pushing. No Release is created by this check.');
