import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldRefreshLocalMetadata, extractSourceMetadata, applySourceMetadata, verifiedModelMetadata, shouldRepairSourceMetadata, metadataFrontmatter, SOURCE_METADATA_VERSION } from './local-metadata.js';

const saved = { importedLocally: true, metadataChecked: true, doi: '10.3758/s13415-020-00796-3' };
assert.equal(shouldRefreshLocalMetadata(saved), false);
assert.equal(shouldRefreshLocalMetadata({ ...saved, metadataWarning: 'No exact record found' }), true);
assert.equal(shouldRefreshLocalMetadata({ ...saved, doi: saved.doi + ')' }), true);
assert.equal(shouldRefreshLocalMetadata({ ...saved, metadataChecked: false }), true);
assert.equal(shouldRefreshLocalMetadata({ ...saved, importedLocally: false, metadataWarning: 'failed' }), false);
assert.equal(shouldRefreshLocalMetadata({ ...saved, doi: undefined }), false);
console.log('Local metadata: retry failed and malformed legacy records, preserve successful cache.');

const title='研究任务中的信息比较与判断';
const node=()=>({title:title+' 张三',fileName:title+'_张三.pdf',authors:[],year:2026,importedLocally:true,metadataWarning:'No match',sourceMetadataVersion:1});
const md=byline=>`# ${title}_张三.pdf\n## PDF Page 1\n2023 年 3 月\n${title}\n${byline}\n(1. 测试大学)\n摘要：合成测试，不包含私人原文。`;
test('Chinese bylines with punctuation, spaces and separated affiliation markers',()=>{
  for(const byline of ['张三，李四','张三   李四','张三 李四','张三\n● 1\n李四\n2']){
    const found=extractSourceMetadata(md(byline),node());
    assert.deepEqual(found.authors,['张三','李四'],byline);assert.equal(found.title,title);assert.equal(found.year,2023);
  }
  assert.deepEqual(extractSourceMetadata(md('王   珣\n1\n, 李四\n1'),node()).authors,['王珣','李四']);
});
test('ordinary English names and comma-separated affiliation markers',()=>{
  const title='Evidence comparison in a synthetic research task';
  for(const byline of ['John Smith, Jane Doe','John Smith1,2*, Jane Doe2','John Smith\n1,2\nJane Doe\n1,2,3*']){
    const found=extractSourceMetadata(`${title}\n${byline}\nDepartment of Testing\nAbstract\nSynthetic data`,{title});
    assert.deepEqual(found.authors,['John Smith','Jane Doe'],byline);
  }
});
test('title hint binds to target below another article abstract',()=>{
  const source=`Previous paper about a different task\nQiong Example\n1\nTesting University\nAbstract\nA different experiment.\n${title}\n张三   李四(通讯作者)   王五\n测试大学\n摘要：目标论文。`;
  const found=extractSourceMetadata(source,node());
  assert.deepEqual(found.authors,['张三','李四','王五']);assert.equal(found.year,null);
  assert.ok(!metadataFrontmatter(source,node()).includes('Qiong Example'));
  const injected={authors:[{name:'Qiong Example',quote:'Qiong Example'}]};
  assert.deepEqual(verifiedModelMetadata(injected,source,node()).authors,[]);
});
test('ambiguous multi-article input never chooses the first byline',()=>{
  const source='First synthetic experiment\nJohn Smith\nTesting University\nAbstract\nBody.\nSecond synthetic experiment\nJane Doe\nTesting University\nAbstract\nBody.';
  const found=extractSourceMetadata(source,{title:'random-file-123',fileName:'random-file-123.pdf'});
  assert.deepEqual(found.authors,[]);assert.equal(found.title,undefined);assert.equal(found.identityResolved,false);
});
test('column names and supervisors are not authors; byline can precede title',()=>{
  const source=`● 品德与心理\n齐晓栋   张大均   邵景进\n${title}\n摘要：合成材料。`;
  assert.deepEqual(extractSourceMetadata(source,{title}).authors,['齐晓栋','张大均','邵景进']);
  const thesis='测试学位论文\n姓名：张三\n指导教师：李四\n答辩日期：2024年5月18日\n摘要\n测试';
  const found=extractSourceMetadata(thesis,{title:'Fixture 0'});
  assert.deepEqual(found.authors,['张三']);assert.equal(found.year,2024);
  assert.deepEqual(verifiedModelMetadata({authors:[{name:'李四',quote:'指导教师：李四'}]},thesis,{title:'Fixture 0'}).authors,[]);
});
test('wrapped source title removes filename annotations, not words in the original',()=>{
  const source='心理状态与行为表现\n——研究条件及其比较\n张三\n1\n李四\n2\n测试大学\n摘要\n测试';
  const found=extractSourceMetadata(source,{fileName:'（用了两个量表）心理状态与行为表现——研究条件及其比较_张三 (1).pdf'});
  assert.deepEqual(found.authors,['张三','李四']);assert.equal(found.title,'心理状态与行为表现 ——研究条件及其比较');
});
test('DOI can resolve opaque filenames, but references and multiple article DOIs cannot',()=>{
  assert.equal(extractSourceMetadata('Unreadable byline\nDOI:10.1234/valid\nAbstract\nBody',{title:'hash'}).doi,'10.1234/valid');
  assert.equal(extractSourceMetadata('Unreadable\nReferences\nDOI:10.1234/peer',{title:'hash'}).doi,'');
  assert.equal(extractSourceMetadata('DOI:10.1234/a\nAbstract\nDOI:10.1234/b\nAbstract',{title:'hash'}).doi,'');
});
test('literal model quotes must belong to a byline in the target, not an invented name',()=>{
  const source=md('张三，李四');
  assert.deepEqual(verifiedModelMetadata({authors:[{name:'张三',quote:'张三，李四'},{name:'李四',quote:'张三，李四'},{name:'王五',quote:'张三，李四'},{name:'品德与心理',quote:'品德与心理'}]},source,node()).authors,['张三','李四']);
  assert.deepEqual(verifiedModelMetadata({authors:[{name:'张三',quote:'张三，李四'}]},source,node()).authors,[],'partial model byline must not replace complete local authors');
  assert.equal(verifiedModelMetadata({title:{value:'不存在的标题',quote:title}},source,node()).title,undefined);
});
test('v1 incomplete metadata is repaired; current unresolved records stay retryable',()=>{
  const n=node();assert.equal(shouldRepairSourceMetadata(n),true);
  applySourceMetadata(n,extractSourceMetadata(md('张三，李四'),n));
  assert.equal(n.sourceMetadataVersion,SOURCE_METADATA_VERSION);assert.equal(n.title,title);assert.equal(n.year,2023);assert.equal(n.sourceMetadataState.status,'complete');
  assert.equal(shouldRepairSourceMetadata(n),false);assert.equal(shouldRepairSourceMetadata(n,md('张三，王五')),true);
  const bad=node();applySourceMetadata(bad,extractSourceMetadata('No readable bibliographic block',bad));
  assert.equal(bad.sourceMetadataState.status,'incomplete');assert.equal(shouldRepairSourceMetadata(bad),true);assert.equal(bad.year,null);
});
test('manual edits, including deliberately cleared fields, survive source repair',()=>{
  const n=node();applySourceMetadata(n,extractSourceMetadata(md('张三，李四'),n));
  n.title='我的研究标题';n.authors=['人工确认'];n.year=2020;
  applySourceMetadata(n,extractSourceMetadata(md('张三，李四'),node()));
  assert.equal(n.title,'我的研究标题');assert.deepEqual(n.authors,['人工确认']);assert.equal(n.year,2020);
  n.authors=[];applySourceMetadata(n,extractSourceMetadata(md('张三，李四'),node()));assert.deepEqual(n.authors,[]);
});
test('verified scholarly fields are preserved, while an empty remote author list can be filled',()=>{
  const n={...node(),title,authors:['Verified Example'],year:2021,metadataApiUrl:'https://example.org/verified'};
  applySourceMetadata(n,extractSourceMetadata(md('张三，李四'),{title}));
  assert.deepEqual(n.authors,['Verified Example']);assert.equal(n.year,2021);
  n.authors=[];delete n.metadataOverrides.authors;
  applySourceMetadata(n,extractSourceMetadata(md('张三，李四'),{title}));assert.deepEqual(n.authors,['张三','李四']);
});
test('truncated filenames still bind exact source prefix/suffix across wrapped titles',()=>{
  const source='亲子关系对儿童心理健康与\n行为发展的影响:一项追踪研究\n*\n张三\n1\n李四\n2\n测试大学\n摘要\n测试';
  const found=extractSourceMetadata(source,{fileName:'亲子关系对儿童心理健康...发展的影响_一项追踪研究_张三 (1).pdf'});
  assert.equal(found.title,'亲子关系对儿童心理健康与行为发展的影响:一项追踪研究');assert.deepEqual(found.authors,['张三','李四']);
});
test('an undecoded separator may split intact names, never reconstruct a missing name glyph',()=>{
  assert.deepEqual(extractSourceMetadata(md('张三 [unmapped PDF symbol] 李四'),node()).authors,['张三','李四']);
  assert.deepEqual(extractSourceMetadata(md('张[unmapped PDF symbol]三'),node()).authors,[]);
});
test('source byline ends before references and title wrapper is not evidence',()=>{
  const source='# copied-file.pdf\n合成学位论文标题\n姓名：张三\n指导教师：李四\n答辩日期：2024年5月18日\n## PDF Page 3\n参考文献\n作者：错误作者';
  assert.deepEqual(extractSourceMetadata(source).authors,['张三']);
  assert.equal(extractSourceMetadata('# copied-file.pdf\nNo readable title or byline',{fileName:'copied-file.pdf'}).title,undefined);
});
test('model cannot use reference authors when the target byline is unreadable',()=>{
  const source=`${title}\nAuthors: undecoded\n2. References\nJohn Smith, Jane Doe\nTesting University`;
  assert.deepEqual(verifiedModelMetadata({authors:[{name:'John Smith',quote:'John Smith, Jane Doe'}]},source,{title}).authors,[]);
  assert.ok(!metadataFrontmatter(source,{title}).includes('John Smith'));
});
test('known automatic authors from a foreign article are retracted when unconfirmed, never manual authors',()=>{
  const n={...node(),authors:['Other Person'],sourceMetadataEvidence:{authors:'Other Person'}};
  const source=`${title}\nAuthors: undecoded\nAbstract\nBody.`;
  applySourceMetadata(n,extractSourceMetadata(source,n));assert.deepEqual(n.authors,[]);assert.ok(n.sourceMetadataState.missing.includes('authors'));
  const manual={...node(),authors:['Other Person'],sourceMetadataEvidence:{authors:'Other Person'},metadataOverrides:{authors:true}};
  applySourceMetadata(manual,extractSourceMetadata(source,manual));assert.deepEqual(manual.authors,['Other Person']);
});
