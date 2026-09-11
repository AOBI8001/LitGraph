import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const out=path.resolve('output/rag-benchmark-v2');
const read=name=>fs.readFile(path.join(out,name),'utf8').then(JSON.parse);
const gold=await read('gold.json'),settings=await read('settings.json'),results=await Promise.all(gold.map(c=>read(c.id+'.json')));
const fingerprint=createHash('sha256').update(JSON.stringify(results.map(r=>({id:r.id,parsed:r.parsed,error:r.error})))).digest('hex');
if(fingerprint!=='5c410f2e28873b730434df38cc2698ad1ecc9e594443b64e23e62fdc663cf4ab')throw Error('Unreviewed predictions: re-adjudicate, never reuse these grades for a new run.');
const partial={
 C04:'第一篇未召回直接报告总样本的参考段落；按共病人数推算 117，但用药人数合计 116，回答明确标为推断且不确定。第二篇 24 正确；不算两篇均完整回答。',
 C06:'足球研究 15 人及观众操纵正确；儿童 OCD 论文人数和年龄未答出，关键段落未召回。',
 C18:'第一篇错误率方向正确。第二篇回答个体差异/控制点，而预设目标为在场类型；其替代回答确实有所给原文依据。题目“另一个调节因素”不唯一，按冻结目标计部分正确，并另报排除此题的敏感性结果。'
};
const notes={
 Q02:'正确区分摘要的治疗后 1 周与方法的治疗后 3 天/首次扫描后 1 周。',
 Q03:'正文年龄 12–16 与表格 12–17 存在不一致；回答报告并指出两处区别，未凭空编造。',
 Q42:'所问 ERN/Pe 样本 36/35 正确；另外明确用 N2 总数 80 减 TSST 42 得 38。',
 Q46:'重复控制，与 Q45 指向同一篇；不进入主要指标。',
 Q47:'本次答出本研究约 65 ms；旧版答成引述的约 100 ms。问题存在目标歧义，另给排除敏感性结果。',
 C03:'指定参考段落只命中一篇，但另一处检索正文足以支持并行发音，因此答案正确。',
 C16:'指定参考段落只命中一篇；其他检索正文支持高工作记忆者与奖赏敏感性的答案。',
 N01:'未泄露/编造账号，但属于安全拒答，不能单独证明知识边界识别；末尾多出英文 supplied，记录为展示质量问题。',
 N02:'拒绝编造目标试验及效应量；额外举例和正文覆盖提示偏长。',
 N03:'未编造不存在的人群数据，额外举例非必需。',
 N04:'未编造未来临床试验，额外举例非必需。'
};
const rows=gold.map((c,i)=>{const r=results[i];return {id:c.id,category:c.category,question:c.question,expected:c.expected,answer:r.parsed?.answer||'',score:r.error ? 0 : partial[c.id] ? 0.5 : 1,outcome:r.error?'runtime-error':partial[c.id]?'partial':c.category==='unanswerable'?'correct-refusal':'correct',note:r.error||partial[c.id]||notes[c.id]||'逐题与参考事实及返回原文核对，所问核心事实一致。',metrics:r.metrics,formatOk:!!r.parsed?.answer&&Array.isArray(r.parsed.suggested_followups)&&r.parsed.suggested_followups.length===3,cited:r.sources?.length>0,sourcePositions:r.sources?.every(s=>s.lineStart>=1&&s.lineEnd>=s.lineStart),planSeconds:r.planSeconds,retrievalSeconds:r.retrievalSeconds,answerSeconds:r.answerSeconds,totalSeconds:r.totalSeconds};});
const ratio=(n,d)=>({numerator:n,denominator:d,rate:d?n/d:null}),sum=(xs,f)=>xs.reduce((s,x)=>s+f(x),0);
function wilson(k,n){const z=1.959964,p=k/n,den=1+z*z/n,c=(p+z*z/(2*n))/den,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return[c-h,c+h];}
function score(xs){const n=xs.filter(x=>x.score===1).length;return{strict:ratio(n,xs.length),weighted:ratio(sum(xs,x=>x.score),xs.length),wilson95:wilson(n,xs.length)};}
const primary=rows.filter(x=>['single-fact','cross-paper'].includes(x.category));
function retrieval(xs){return{recall:ratio(sum(xs,x=>x.metrics?.recovered||0),sum(xs,x=>x.metrics?.goldUnits||0)),referencePrecision:ratio(sum(xs,x=>x.metrics?.relevantChunks||0),sum(xs,x=>x.metrics?.retrievedChunks||0))};}
function latency(field){const values=rows.map(x=>x[field]).filter(Number.isFinite).sort((a,b)=>a-b),n=values.length;return {median:n%2?values[(n-1)/2]:(values[n/2-1]+values[n/2])/2,p95:values[Math.ceil(n*.95)-1],total:sum(values,x=>x)};}
const common=primary.filter(x=>!x.id.startsWith('C')||Number(x.id.slice(1))<=5);
const summary={benchmark:settings.name,provider:settings.provider,modelIdKnown:false,predictionsFingerprint:fingerprint,primary:score(primary),single:score(primary.filter(x=>x.category==='single-fact')),comparison:score(primary.filter(x=>x.category==='cross-paper')),negative:score(rows.filter(x=>x.category==='unanswerable')),negativeExcludingPrivacyControl:score(rows.filter(x=>x.category==='unanswerable'&&x.id!=='N01')),retrieval:retrieval(primary),same54Questions:{answers:score(common),retrieval:retrieval(common)},sensitivityExcludingC18:score(primary.filter(x=>x.id!=='C18')),sensitivityCommonExcludingQ47:score(common.filter(x=>x.id!=='Q47')),format:ratio(rows.filter(x=>x.formatOk).length,rows.length),citedAnswerable:ratio(primary.filter(x=>x.cited).length,primary.length),validSourcePositions:ratio(primary.filter(x=>x.sourcePositions).length,primary.length),runtimeSuccess:ratio(rows.filter(x=>x.outcome!=='runtime-error').length,rows.length),latency:Object.fromEntries(['planSeconds','retrievalSeconds','answerSeconds','totalSeconds'].map(f=>[f,latency(f)])),adjudicator:'Executing AI assistant; not independent human expert review',badCases:rows.filter(x=>x.score<1||x.id==='N01').map(({id,note})=>({id,note}))};
await fs.writeFile(path.join(out,'audit.json'),JSON.stringify(rows,null,2));await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
const fields=['id','category','score','outcome','totalSeconds','question','expected','answer','note'],cell=s=>'"'+String(s??'').replaceAll('"','""')+'"';
await fs.writeFile(path.join(out,'cases.csv'),'\uFEFF'+fields.join(',')+'\r\n'+rows.map(r=>fields.map(f=>cell(r[f])).join(',')).join('\r\n'));
console.log(JSON.stringify(summary,null,2));
