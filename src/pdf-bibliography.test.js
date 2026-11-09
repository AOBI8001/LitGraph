import test from 'node:test';import assert from 'node:assert/strict';
import {bibliographyPage,sanitizeBibliography,ocrBibliographyPage} from './pdf-bibliography.js';
import {extractSourceMetadata,applySourceMetadata,applyScholarlyIdentity,metadataFrontmatter} from './local-metadata.js';
import {repairSourceMetadata} from './source-metadata-repair.js';
const row=(text,y,size=12,x=50)=>({text,y,size,x});const page=lines=>({page:1,width:600,height:800,lines});
const doc=lines=>({markdown:'# opaque.pdf\nOriginal stream order is deliberately different.',bibliography:{version:1,pages:[page(lines)]}});
const opaque=()=>({fileName:'opaque.pdf',title:'opaque',importedLocally:true,authors:[]});

test('PDF layout deduplicates offset bold text and keeps separated columns',()=>{
 const item=(str,x,y,size,width)=>({str,transform:[size,0,0,size,x,y],width});
 const result=bibliographyPage({view:[0,0,600,800]},[item('Same title',70,700,20,150),item('Same title',70.32,700,20,150),item('Author One',70,650,12,90),item('DOI: 10.1234/test',400,650,8,100)],1);
 assert.equal(result.lines[0].text,'Same title');assert.equal(result.lines.length,3);
});

test('opaque PDF uses visually preceding byline, never content-stream body order',()=>{
 const d=doc([row('Synthetic Journal',760,9),row('2018, vol. 49(1) 3–10',745,9),row('DOI - 10.1234/fixture',730,9),row('Bernard Fixture',660,11),row('Contributions of a synthetic attribution approach to learning',610,18),row('Abstract: Synthetic data only.',570,10)]);
 const found=extractSourceMetadata(d.markdown,opaque(),d);
 assert.equal(found.title,'Contributions of a synthetic attribution approach to learning');assert.deepEqual(found.authors,['Bernard Fixture']);assert.equal(found.year,2018);assert.equal(found.doi,'10.1234/fixture');
});

test('wrapped title and affiliation-interleaved authors are a single header',()=>{
 const d=doc([row('A synthetic account of service failures:',730,22),row('evidence from three examples',705,22),row('Wenqi Fixture',675,13),row('Department of Testing, Example University',655,10),row('Laurie Fixture',630,13),row('Example University',610,10),row('Stephanie Q. Fixture',585,13),row('Example University',565,10),row('Abstract',535,10),row('Vol. 37 No. 2, 2026',45,8)]);
 const result=extractSourceMetadata(d.markdown,opaque(),d);assert.equal(result.title,'A synthetic account of service failures: evidence from three examples');assert.deepEqual(result.authors,['Wenqi Fixture','Laurie Fixture','Stephanie Q. Fixture']);assert.equal(result.year,2026);
});

test('date parser uses publication year, not page number, body dates, received date or grant',()=>{
 const title='A synthetic comparison of learning tasks';
 const text=`Synthetic Psychology 2025, Vol. 57, No. 11, 1885–1900\nReceived: 2024-02-08\n基金项目 2019\n${title}\nAlice Fixture, Bob Fixture\nExample University\nAbstract\nStudies published between 2005 and 2016 were compared.`;
 const result=extractSourceMetadata(text,{title});assert.equal(result.year,2025);
 const noDate=extractSourceMetadata(`${title}\nAlice Fixture, Bob Fixture\nExample University\nAbstract\nStudies published between 2005 and 2016 were compared.`,{title});assert.equal(noDate.year,null);
});

test('repeated cover/title uses the actual article page for dates and DOI',()=>{
 const title='A synthetic paper about learning';const d=doc([]);d.bibliography.pages=[page([row(title,700,18),row('Article in a repository · 2019',680,10),row('DOI: 10.1234/wrong-cover',660,9)]),{...page([row(title,700,18),row('Alice Fixture, Bob Fixture',670,12),row('Example University',650,10),row('Abstract',620,10),row('Synthetic Journal 2024;12:25-30',35,9),row('DOI: 10.1234/correct-article',20,9)]),page:2}];
 const result=extractSourceMetadata(d.markdown,opaque(),d);assert.equal(result.year,2024);assert.equal(result.doi,'10.1234/correct-article');
});

test('Chinese student titles and spaced names do not become affiliations or merged authors',()=>{
 for(const title of ['大学新生的合成判断任务研究','大学毕业生的合成判断任务研究']){
 const result=extractSourceMetadata(`${title}\n张银花  李  红  吴  寅\n测试大学\n摘要\n合成材料`,{fileName:title+'_张银花.pdf'});assert.equal(result.title,title);assert.deepEqual(result.authors,['张银花','李红','吴寅']);}
});

test('a side-column thesis title label cannot interrupt its multiline value',()=>{
 const title='大学生合成判断与学习能力的调查研究',d=doc([row('大学生合成判断与',700,18),row('论文题目',680,10,20),row('学习能力的调查研究',680,18,190),row('作者姓名',630,12),row('王聪',630,16,250),row('测试大学',600,12),row('2023 年 6 月',100,12)]);
 const result=extractSourceMetadata(d.markdown,{fileName:title+'_王聪.pdf'},d);assert.equal(result.title,title);assert.deepEqual(result.authors,['王聪']);assert.equal(result.year,2023);
});

test('repeated thesis covers prefer the source byline corroborated by the filename',()=>{
 const title='大学生合成判断与学习能力的调查研究';
 const d=doc([row(title,700,20),row('作者姓名',630,12),row('王丛',630,16,250),row('测试大学',600,12)]);
 d.bibliography.pages.push({...page([row(title,700,20),row('作者姓名',630,12),row('王聪',630,16,250),row('测试大学',600,12)]),page:2});
 const result=extractSourceMetadata(d.markdown,{fileName:title+'_王聪.pdf'},d);assert.deepEqual(result.authors,['王聪']);assert.match(result.evidence.authors,/王聪/);
});

test('separate thesis author label, punctuation and value exclude supervisors and signatures',()=>{
 const d=doc([row('合成知觉判断任务的实验研究',700,20),row('作 者 姓 名',600,16),row(':',580),row('王 聪',560,16),row('指导教师：李四',520,16),row('2013 年 5 月',100,16)]);
 const result=extractSourceMetadata(d.markdown,{fileName:'合成知觉判断任务的实验研究_王聪.pdf'},d);assert.deepEqual(result.authors,['王聪']);assert.equal(result.year,2013);
 const bad=extractSourceMetadata('论文作者签名\n姓名：签名\n日期 年 月',{fileName:'hash.pdf'});assert.deepEqual(bad.authors,[]);
});

test('OCR fills missing explicit thesis date without replacing verified identity',()=>{
 const title='合成知觉判断任务的实验研究';const d=doc([row(title,700,20),row('作者姓名：王聪',600,16),row('测试大学',580),row('摘要',540)]);
 d.bibliography.ocr={attempted:true,supported:true};d.bibliography.ocrPages=[page([row('乱码片段',700),row('论文提交日期 2013 年 1 月',100),row('Copyright 2022 CNKI',20)])];
 const found=extractSourceMetadata(d.markdown,{fileName:title+'_王聪.pdf'},d);assert.equal(found.year,2013);assert.deepEqual(found.authors,['王聪']);assert.equal(found.title,title);assert.equal(found.ocrUsed,true);
});

test('OCR geometry is mapped to PDF order and bounded at persistence boundary',()=>{
 const p=ocrBibliographyPage([{text:'作者姓名：',x:10,y:100,width:90,height:15},{text:'张三',x:180,y:100,width:30,height:15}],600,800,1);assert.equal(p.lines[0].text,'作者姓名:');assert.equal(p.lines[1].text,'张三');
 const clean=sanitizeBibliography({version:1,pages:[p],ocr:{attempted:true,supported:true,secret:'omit'},ocrPages:[p],info:{title:'Example',path:'private'}});assert.equal(clean.ocrPages.length,1);assert.equal(clean.info.path,undefined);assert.equal(clean.ocr.secret,undefined);assert.equal(sanitizeBibliography({version:999,pages:[]}),null);
});

test('verified original-language identity survives scholarly aliases and manual edits',()=>{
 const n={title:'源文献标题',authors:['张三'],year:2024,doi:'10.1234/a',sourceMetadataEvidence:{title:'源文献标题',authors:'张三',year:'2024'},metadataOverrides:{}};
 applyScholarlyIdentity(n,{title:'English title alias',authors:['Zhang San'],year:2025,doi:'10.1234/a'});assert.equal(n.title,'源文献标题');assert.deepEqual(n.authors,['张三']);assert.equal(n.year,2024);assert.deepEqual(n.metadataAliases.authors,['Zhang San']);
 n.metadataOverrides.authors=true;n.authors=['人工作者'];applyScholarlyIdentity(n,{authors:['Other Author']});assert.deepEqual(n.authors,['人工作者']);
});

test('missing deterministic title may use an evidence-validated model fallback',async()=>{
 const n=opaque(),d={markdown:'An ambiguous-looking but single synthetic header\nAuthors: undecoded\nAbstract\nSynthetic body.'};let calls=0;
 await repairSourceMetadata(n,d,{model:async()=>{calls++;return {title:{value:'An ambiguous-looking but single synthetic header',quote:'An ambiguous-looking but single synthetic header'},authors:[]};}});
 assert.equal(calls,1);assert.equal(n.title,'An ambiguous-looking but single synthetic header');assert.ok(n.sourceMetadataState.missing.includes('authors'));
});

test('changed source invalidates automatic v2 dates while manual settings survive',()=>{
 const title='合成任务中的文献信息识别';const n={...opaque(),title,fileName:title+'.pdf',year:1885,sourceMetadataVersion:2,sourceMetadataApplied:{year:1885,title},sourceMetadataEvidence:{title},metadataWarning:'No match'};
 applySourceMetadata(n,extractSourceMetadata(`${title}\n张三，李四\n测试大学\n2025 年 6 月\n摘要`,n));assert.equal(n.year,2025);assert.equal(n.metadataOverrides.year,undefined);
});


test('bibliography remains repairable when body conversion did not produce Markdown',async()=>{
 const d={bibliography:{version:1,pages:[page([row('合成判断任务的研究方法',700,20),row('作者姓名：张三',650,12),row('2024 年 6 月',100,12)])]}};
 const n={fileName:'合成判断任务的研究方法_张三.pdf',title:'合成判断任务的研究方法 张三',importedLocally:true,authors:[]};
 await repairSourceMetadata(n,d);assert.deepEqual(n.authors,['张三']);assert.equal(n.year,2024);assert.equal(n.sourceMetadataState.status,'complete');
});

test('v3 migration restores original-language fields previously replaced by remote aliases',()=>{
 const n={fileName:'合成判断任务的研究方法_张三.pdf',title:'An old English alias',authors:['Zhang San'],year:2025,doi:'10.1234/same',importedLocally:true,sourceMetadataVersion:2,metadataApiUrl:'https://example.org/record',sourceMetadataApplied:{title:'An old English alias',authors:['Zhang San'],year:2025}};
 const source='合成判断任务的研究方法\n张三，李四\n测试大学\n2024 年 6 月\nDOI: 10.1234/same\n摘要';applySourceMetadata(n,extractSourceMetadata(source,n));assert.equal(n.title,'合成判断任务的研究方法');assert.deepEqual(n.authors,['张三','李四']);assert.equal(n.year,2024);assert.deepEqual(n.metadataAliases.authors,['Zhang San']);
});
