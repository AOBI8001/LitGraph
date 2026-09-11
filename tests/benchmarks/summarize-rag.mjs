// Post-run assistant adjudication. Never changes the frozen questions or predictions.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const output = path.resolve(process.argv[2] || 'output/rag-benchmark');
const read = file => fs.readFile(path.join(output,file),'utf8').then(JSON.parse);
const gold = await read('gold.json'), retrieval = await read('retrieval.json'), settings = await read('settings.json');
const predictions = await Promise.all(gold.map(async c => {
 const r = await read(c.id+'.json');
 return {id:c.id,result:r.result,error:r.error};
}));
const reviewedFingerprint = 'f573ba637fc568cbf55007a18080abfbfdf1c4d87f035e48c2773947e382a924';
if(createHash('sha256').update(JSON.stringify(predictions)).digest('hex')!==reviewedFingerprint)
 throw new Error('These predictions have not been reviewed. Re-adjudicate new answers; do not reuse baseline scores.');
const zeroRefusals = new Set(['Q01','Q05','Q08','Q11','Q12','Q18','Q22','Q27','Q39','Q45','Q48','C04','C05']);
const partial = {
 Q34:'答出 12 秒，但未答出安静、出声、耳语三个条件。',
 Q44:'答出 56 人，但未答出 27 对同卵双胞胎。',
 Q50:'正确指出不能归因于低内部一致性，但对测量噪声未给出原文的完整结论。',
 C01:'第一篇 21/40 正确，第二篇 12/14 未答出。',
 C02:'第一篇 80/76 正确，第二篇 31/31/31 及未患病一级亲属未答出。',
 C03:'网络摄像头正确，另一篇并行发音操作未答出。',
};
const special = {
 Q02:'摘要写治疗完成后 1 周，方法写治疗后 3 天（首次扫描后 1 周）；回答主动说明两处差异，按原文一致性判正确。',
 Q09:'在发送的另一段方法文本中找到 20/17/20；指定参考段落未命中，但回答正确。',
 Q13:'另一段 Participants 文本包含 80/76，回答正确。',
 Q14:'另一段方法文本包含 42/42，回答正确。',
 Q21:'发送的片段讨论正确反应也有增强、过度活跃的监测及 CRN；回答与原文一致。',
 Q23:'另一段综述文本支持非 OCD 特异性及焦虑/抑郁障碍，回答正确。',
 Q24:'发送的样本表有 PDF 字符混杂，但三组均可读到 n=24，回答正确。',
 Q32:'发送的另一段 General discussion 明确说明实验2重复无意义音节，回答正确。',
 Q43:'另一段引言明确 eat that food to satiety，回答正确。',
 Q46:'重复控制：与 Q45 请求完全相同，但本题答对、Q45 拒答；不进入主要得分。',
 Q47:'预期本研究约 65 ms，回答给出既往研究约 100 ms，并明确称其为引述。该数值确实存在于发送的上下文；不是凭空编造，但没有回答预设的本研究结果。问题未明确写“本研究而非引述”，存在表述歧义，另给排除此题的敏感性结果。',
};
const rows=[];
for(const c of gold){
 const result=await read(c.id+'.json'), r=retrieval.find(x=>x.id===c.id);
 let score=1, outcome='correct',note=special[c.id]||'逐题与原文参考事实核对，所需事实一致。';
 if(c.category==='unanswerable'){outcome='correct-refusal';note='明确没有库内依据，未编造目标事实。';}
 if(zeroRefusals.has(c.id)){score=0;outcome='insufficient-evidence';note='原文可回答，但返回未包含完整的所需事实；对当前上下文诚实拒答不等于幻觉。';}
 if(partial[c.id]){score=.5;outcome='partial';note=partial[c.id];}
 if(c.id==='Q47'){score=0;outcome='wrong-target-result';}
 if(result.error){score=0;outcome='runtime-error';note=result.error;}
 const parsed=result.result?.parsed;
 const formatOk=!!parsed&&typeof parsed.answer==='string'&&!!parsed.answer.trim()&&Array.isArray(parsed.suggested_followups)&&parsed.suggested_followups.length===3&&parsed.suggested_followups.every(x=>typeof x==='string'&&x.trim());
 rows.push({id:c.id,category:c.category,question:c.question,expected:c.expected,answer:parsed?.answer||result.result?.raw||'',score,outcome,note,formatOk,durationSeconds:result.durationSeconds,
  goldLocations:c.gold.map(g=>({documentId:g.documentId,lineStart:g.lineStart,lineEnd:g.lineEnd})),retrieval:r.metrics,selectedPaperControl:r.selectedPaperControl});
}
const primary=rows.filter(x=>['single-fact','cross-paper'].includes(x.category));
const sum=(xs,fn)=>xs.reduce((s,x)=>s+fn(x),0);
const ratio=(n,d)=>({numerator:n,denominator:d,rate:n/d});
function wilson(k,n){const z=1.959964,p=k/n,den=1+z*z/n,c=(p+z*z/(2*n))/den,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return [c-h,c+h];}
function scores(xs){const correct=xs.filter(x=>x.score===1).length;return {strict:ratio(correct,xs.length),weighted:ratio(sum(xs,x=>x.score),xs.length),wilson95: wilson(correct,xs.length),outcomes:Object.fromEntries([...new Set(xs.map(x=>x.outcome))].map(o=>[o,xs.filter(x=>x.outcome===o).length]))};}
const singles=primary.filter(x=>x.category==='single-fact'),cross=primary.filter(x=>x.category==='cross-paper'),negative=rows.filter(x=>x.category==='unanswerable');
const finished=rows.filter(x=>x.outcome!=='runtime-error'),times=finished.map(x=>x.durationSeconds).sort((a,b)=>a-b);
const percentile=p=>times[Math.max(0,Math.ceil(p*times.length)-1)];
const summary={benchmark:settings.benchmark,softwareVersion:settings.softwareVersion,provider:settings.provider,model:settings.model,
 primary:scores(primary),singlePaperQuestions:scores(singles),crossPaperQuestions:scores(cross),negative:scores(negative),
 recall:ratio(sum(primary,x=>x.retrieval.recovered),sum(primary,x=>x.retrieval.goldUnits)),
 referencePrecision:ratio(sum(primary,x=>x.retrieval.relevantChunks),sum(primary,x=>x.retrieval.retrievedChunks)),
 selectedPaperRetrievalOnly:ratio(sum(singles,x=>x.selectedPaperControl.recovered),sum(singles,x=>x.selectedPaperControl.goldUnits)),
 format:ratio(rows.filter(x=>x.formatOk).length,rows.length),successfulCalls:ratio(finished.length,rows.length),
 latency:{medianSeconds:times.length%2?times[(times.length-1)/2]:(times[times.length/2-1]+times[times.length/2])/2,p95Seconds:percentile(.95),totalSeconds:sum(rows,x=>x.durationSeconds)},
 sensitivityExcludingAmbiguousQ47:scores(primary.filter(x=>x.id!=='Q47')),
 answerAccuracyAmongCompletedCalls:scores(primary.filter(x=>x.outcome!=='runtime-error')),
 adjudicator:'Executing AI assistant; not independent human or expert review',
 limitations:settings.caveats,
};
await fs.writeFile(path.join(output,'audit.json'),JSON.stringify(rows,null,2));
await fs.writeFile(path.join(output,'summary.json'),JSON.stringify(summary,null,2));
const fields=['id','category','score','outcome','durationSeconds','question','expected','answer','note'];
const cell=s=>'"'+String(s??'').replaceAll('"','""')+'"';
await fs.writeFile(path.join(output,'cases.csv'),'\uFEFF'+fields.join(',')+'\r\n'+rows.map(r=>fields.map(f=>cell(r[f])).join(',')).join('\r\n'));
console.log(JSON.stringify(summary,null,2));
