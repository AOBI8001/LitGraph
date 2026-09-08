import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pngToIco from 'png-to-ico';
await mkdir('output/build-resources', { recursive: true });
await writeFile('output/build-resources/litgraph.ico', await pngToIco('src/assets/brand/litgraph-mark.png'));
// Retain verbatim license/notice files for frontend dependencies bundled by Vite.
const all = new Map();
for (const folder of await readdir('node_modules/.pnpm')) {
 const base = path.join('node_modules/.pnpm', folder, 'node_modules');
 let names; try { names = await readdir(base); } catch { continue; }
 const packages = [];
 for (const name of names) {
  if (name.startsWith('@')) { for (const child of await readdir(path.join(base, name)).catch(() => [])) packages.push(name + '/' + child); }
  else packages.push(name);
 }
 for (const name of packages) {
  const directory = path.join(base, name);
  try { const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'))); if (!all.has(manifest.name)) all.set(manifest.name, { manifest, directory }); } catch {}
 }
}
const queue = ['d3', '3d-force-graph', 'three', 'three-spritetext', 'pdfjs-dist'], seen = new Set(), index = [];
// Prefer the installed direct dependency over stale pnpm cache versions.
for (const name of queue) {
 const directory = path.join('node_modules', name);
 const manifest = JSON.parse(await readFile(path.join(directory, 'package.json')));
 all.set(name, { manifest, directory });
}
await mkdir('dist/third-party-licenses', { recursive: true });
while (queue.length) {
 const name = queue.shift(); if (seen.has(name)) continue; seen.add(name);
 const entry = all.get(name); if (!entry) continue;
 const { manifest, directory } = entry;
 index.push({ name, version: manifest.version, license: manifest.license });
 for (const file of await readdir(directory)) if (/^(license|licence|notice)(\.|$)/i.test(file)) {
  const bytes = await readFile(path.join(directory, file)).catch(() => null);
  if (bytes) await writeFile(path.join('dist/third-party-licenses', name.replaceAll('/', '__') + '-' + file), bytes);
 }
 queue.push(...Object.keys(manifest.dependencies || {}));
}
await writeFile('dist/third-party-licenses/index.json', JSON.stringify(index, null, 2));
console.log(`Desktop icon and notices for ${index.length} bundled dependency packages prepared.`);
