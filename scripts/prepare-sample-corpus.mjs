import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sample from '../src/public-sample.js';

// Explicit local manifest only. No remote downloads, synthetic text or model output.
// Output is ignored by git: distribution rights must be reviewed separately.
const root = fileURLToPath(new URL('..', import.meta.url));
const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Usage: node scripts/prepare-sample-corpus.mjs <local source-manifest.json>');
const manifest = JSON.parse(await readFile(path.resolve(manifestPath), 'utf8'));
const target = path.join(root, 'public', 'sample-fulltext');
const documents = [], files = new Map();
for (const node of sample.nodes) {
  // Two sample graph nodes represent editions of the same bibliographic work.
  const canonicalId = node.id === 'paper-046' ? 'paper-045' : node.id;
  const source = manifest.find(item => item.id === canonicalId);
  if (!source?.text) throw new Error(`Missing source mapping: ${node.id}`);
  let text = (await readFile(source.text, 'utf8')).replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
  // Remove website navigation / local extraction prefaces, not article content.
  if (text.includes('Search PMC Full-Text Archive')) {
    const boundary = text.indexOf('PMC Copyright Notice');
    if (boundary < 0) throw new Error(`Unrecognized PMC extraction: ${node.id}`);
    text = text.slice(boundary + 'PMC Copyright Notice'.length);
  }
  if (text.startsWith('Full-text extraction from the ScienceDirect article page')) {
    const boundary = text.indexOf('\nElsevier\nCortex\n');
    if (boundary < 0) throw new Error(`Unrecognized publisher extraction: ${node.id}`);
    text = text.slice(boundary + 1);
  } else if (text.startsWith('Full-text extraction from author-uploaded PDF')) {
    const boundary = text.indexOf('\n\n');
    text = text.slice(boundary + 2);
  }
  text = text.replace(/^(?:--- Page (\d+) ---|===== PAGE (\d+) =====)\s*$/gm, (_, a, b) => `## PDF Page ${a || b}\n`)
    .replace(/\uFB00/g, 'ff').replace(/\uFB01/g, 'fi').replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi').replace(/\uFB04/g, 'ffl').replace(/\n{4,}/g, '\n\n\n').trim();
  if (text.length < 5000) throw new Error(`Source too short for full-text sample: ${node.id}`);
  if (/(?<![a-z])(?:[A-Z]:[\\/]|file:\/\/\/|\\Users\\|Bearer\s+[\w.-]{12,})/i.test(text)) throw new Error(`Private path/credential marker in source: ${node.id}`);
  const markdown = `# ${sample.nodes.find(n => n.id === canonicalId).title}\n\n${text}\n`;
  const sha256 = createHash('sha256').update(markdown).digest('hex');
  const pageCount = [...markdown.matchAll(/^## PDF Page (\d+)$/gm)].length || null;
  const file = `${canonicalId}.md`;
  files.set(file, markdown);
  documents.push({ id: node.id, canonicalId, title: node.title, doi: node.doi, file, sha256,
    sourceKind: pageCount ? 'pdf_text' : 'extracted_text', pageCount, characters: markdown.length });
}
await mkdir(target, { recursive: true });
for (const [file, content] of files) await writeFile(path.join(target, file), content, 'utf8');
await writeFile(path.join(target, 'index.json'), JSON.stringify({schemaVersion: 1, nodeCount: documents.length,
  uniqueDocumentCount: files.size, pdfCount: 0, documents}, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({nodes: documents.length, markdownFiles: files.size, pdfFiles: 0, output: target}));
