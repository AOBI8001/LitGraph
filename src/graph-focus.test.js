import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { linkMatchesSelection } from './graph-focus.js';
for (const links of [[{source:'a',target:'b'},{source:'b',target:'c'}], [{source:{id:'a'},target:{id:'b'}},{source:{id:'b'},target:{id:'c'}}]]) {
  assert.equal(links.filter(l=>linkMatchesSelection(l,null)).length,2);
  assert.equal(links.filter(l=>linkMatchesSelection(l,{id:'a'})).length,1);
  assert.equal(links.filter(l=>linkMatchesSelection(l,{id:'b'})).length,2);
}
const source=readFileSync(new URL('./main.js',import.meta.url),'utf8');
assert.ok(source.match(/linkMatchesSelection\(link, selectedNode\)/g).length >= 4);
assert.doesNotMatch(source, /const focus = .*hoveredNode/);
console.log('Link focus: string/object endpoints, click selection, clear selection, shared 2D/3D policy passed.');
