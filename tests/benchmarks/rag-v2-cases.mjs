import fs from 'node:fs/promises';
import sample from '../../src/public-sample.js';
import {goldRows,negativeRows} from './rag-gold.mjs';
import {loadSampleDocument} from '../../src/sample-corpus.js';
export const documents=await Promise.all(sample.nodes.map(async node=>({node,document:await loadSampleDocument(node,file=>fs.readFile('public/sample-fulltext/'+file,'utf8'))})));
const flat=s=>s.toLowerCase().replace(/\s/g,'');
function span(n,start,end){const d=documents[n-1],source=d.document.markdown,positions=[...source.matchAll(/\S/g)].map(m=>m.index),a=flat(source).indexOf(flat(start)),b=flat(source).indexOf(flat(end),a);if(a<0||b<0)throw Error('Missing gold '+n);const left=positions[a],right=positions[b+flat(end).length-1]+1;return {documentId:d.node.id,canonicalId:n===46?'paper-045':d.node.id,start:left,end:right,text:source.slice(left,right),lineStart:source.slice(0,left).split('\n').length,lineEnd:source.slice(0,right).split('\n').length};}
export const cases=goldRows.map(([n,q,expected,a,b])=>({id:'Q'+String(n).padStart(2,'0'),category:n===46?'duplicate-control':'single-fact',documentId:documents[n-1].node.id,question:`针对论文《${documents[n-1].node.title}》：${q} 请简短回答，只回答所问事实；证据不足请明确说明。`,expected,gold:[span(n,a,b)]}));
const comparisons=[
 [7,11,'比较两篇研究的 OCD 患者及健康对照样本量，按论文分别给出。'],
 [13,15,'分别给出两篇研究的各组样本量，并说明后一篇是否包含未患病一级亲属。'],
 [26,32,'第一篇用什么装置让人相信被观察，第二篇实验2增加了什么操作阻止言语复述？'],
 [20,24,'这两篇研究的 OCD 患者样本量分别是多少？'],
 [39,44,'这两篇研究的样本量分别是多少？前者年龄范围和后者同卵双胞胎对数是多少？'],
 [3,29,'分别报告两篇研究的参与者人数；第一篇的年龄范围和第二篇的压力操纵是什么？'],
 [4,38,'第一篇的 Go/No-Go 和 Stop-signal 分别测量什么，第二篇除 Stroop 外还使用哪两个任务？'],
 [8,20,'第一篇用了哪三类抑制任务，第二篇用什么任务测 ERN、纳入多少 OCD 患者？'],
 [10,39,'第一篇科学博物馆社区样本两组分别多少人，第二篇总样本多少人、年龄范围是多少？'],
 [11,24,'请分别列出两篇研究各组的诊断和人数。'],
 [14,15,'第一篇无药物患者和对照各多少人，第二篇患者、未患病一级亲属及无亲缘对照各多少人？'],
 [16,43,'第一篇如何促成并识别习惯，第二篇如何让食物结果贬值？'],
 [19,49,'第一篇错误加工元分析的两组人数分别是多少，第二篇汇总了几项研究？'],
 [25,29,'第一篇用哪三种金钱后果区分情境，第二篇如何操纵压力、纳入多少球员？'],
 [27,28,'社会观察对第一篇两组的 ERN 有何影响；社会评价对第二篇 Hot/Cool 抑制有何影响？'],
 [31,37,'第一篇哪类工作记忆者更易表现失常；第二篇更支持奖赏敏感性增强还是认知控制破坏？'],
 [32,34,'第一篇实验2如何阻止复述；第二篇字母保持多少秒、有哪几种发音条件？'],
 [35,36,'第一篇竞争如何影响 No-Go 错误；第二篇除任务复杂度、评价情境外还强调哪个调节因素？'],
 [41,42,'第一篇使用哪种 MR 拮抗剂、剂量多少；第二篇 TSST 和对照组人数分别是多少？'],
 [44,50,'第一篇总人数及同卵双胞胎对数是多少；第二篇能否用测量噪声和低内部一致性解释低时间稳定性？']
];
comparisons.forEach(([a,b,q],i)=>{const first=cases[a-1],second=cases[b-1];cases.push({id:'C'+String(i+1).padStart(2,'0'),category:'cross-paper',question:`比较《${documents[a-1].node.title}》与《${documents[b-1].node.title}》：${q} 请简短回答，证据不足请说明。`,expected:first.expected+'；'+second.expected,gold:[...first.gold,...second.gold]});});
for(const[id,question,expected]of negativeRows)cases.push({id,category:'unanswerable',question,expected,gold:[]});
// Development questions ask DIFFERENT facts from final benchmark questions.
const devRows=[
 [4,'综述提到抑制表现依赖哪三种神经递质？','dopamine, noradrenaline, serotonin','inhibitory\nperformance is dependent upon dopamine','noradrenaline, and serotonin signaling'],
 [4,'综述认为反应抑制和干扰控制依赖什么神经环路？','CSTC','motor response inhibition and interference control are dependent on cortical','thalamic–cortical (CSTC) circuits.'],
 [7,'OCD 和健康对照的平均年龄各是多少？','42.95,35.13','OCD participants (mean age, 42.95 years)','40 healthy controls (mean age, 35.13 years).'],
 [7,'SSRT 与当前 OCD、焦虑和抑郁严重度是否相关？','未发现相关','there was no correlation','SSRT and current levels of OCD, anxiety, and depression severity.'],
 [13,'测试电池包含哪三种行为任务和哪一种自评量表？','SST,DDT,BART,BIS-11','Participants completed a test battery','Barratt Impulsiveness scale (BIS-11).'],
 [16,'电击回避研究的 OCD 和对照组各多少人？','25,25','Twenty-five OCD patients and 25 control subjects','Twenty-five OCD patients and 25 control subjects'],
 [16,'两组的条件性唤醒在各阶段是否不同，测量指标是什么？','无差异；皮肤电反应','Groups did not differ in conditioned','arousal (skin conductance responses) at any stage.'],
 [16,'习惯测验后，两组在联结知识和电击预期评分上是否不同？','无差异','groups did not differ in contingency knowledge','shock expectancy following the habit test.']
];
export const development=devRows.map(([n,q,expected,a,b],i)=>({id:'D'+String(i+1).padStart(2,'0'),category:'development',question:`针对论文《${documents[n-1].node.title}》：${q}`,expected,gold:[span(n,a,b)]}));
for(const[a,b]of [[1,5],[2,6],[3,7],[4,8]]){const x=development[a-1],y=development[b-1];development.push({id:'D'+String(development.length+1).padStart(2,'0'),category:'development-comparison',question:x.question+' 同时回答：'+y.question,expected:x.expected+'；'+y.expected,gold:[...x.gold,...y.gold]});}
export function metrics(evidence,gold){if(!gold.length)return null;const ranges=gold.map(()=>[]);let relevant=0;for(const e of evidence){let hit=false;for(let i=0;i<gold.length;i++){const g=gold[i];if((e.documentId==='paper-046'?'paper-045':e.documentId)!==g.canonicalId)continue;let left=e.startOffset,right=e.endOffset;if(left===undefined){const source=documents.find(x=>x.node.id===e.documentId).document.markdown;left=source.indexOf(e.text);right=left+e.text.length;}const a=Math.max(left,g.start),b=Math.min(right,g.end);if(b>a){ranges[i].push([a,b]);if(b-a>=Math.min(20,(g.end-g.start)/2))hit=true;}}if(hit)relevant++;}const ratios=ranges.map((r,i)=>{r.sort((a,b)=>a[0]-b[0]);let n=0,end=-1;for(const[a,b]of r){n+=Math.max(0,b-Math.max(end,a));end=Math.max(end,b);}return n/(gold[i].end-gold[i].start);});return {recovered:ratios.filter(x=>x>=.8).length,goldUnits:gold.length,relevantChunks:relevant,retrievedChunks:evidence.length,coverage:ratios};}
