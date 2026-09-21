import {explicitTargets} from './research-evidence.js';
import {isCollectionOverview} from './research-overview.js';

export function researchRoute(question,nodes=[]){
 const ids=explicitTargets(nodes.map(node=>({node})),question);
 const count=ids.length||nodes.length;
 if(count<2)return {kind:'local-fact',route:'relevance',task:'fact',scopeIds:ids};
 if(isCollectionOverview(question,count))return {kind:'collection-overview',route:'coverage',task:'overview',scopeIds:ids,
  summaryField:/方法|methods?/i.test(question)?'methods':/结论|发现|结果|findings?|results?/i.test(question)?'findings':/对象|人群|population/i.test(question)?'population':'researchQuestion'};
 const q=String(question);
 const boundedMultiScope=!ids.length&&nodes.length>=2&&nodes.length<=8;
 const comparison=boundedMultiScope||/比较|对比|异同|区别|不同|差异|分别|共同结论|分歧|\bcompar\w*\b|\bdifferences?\b|\bcommon findings\b/i.test(q);
 const selection=/(?:哪些|哪几篇|找出|列出|筛选).{0,35}(?:论文|文献|研究)|(?:论文|文献|研究).{0,20}(?:哪些|哪几篇)|\b(?:which (?:papers|studies)|list (?:all |the )?(?:papers|studies)|find all)\b/i.test(q);
 const exhaustive=/(?:每篇|逐篇|各篇|所有论文|全部文献).{0,30}(?:方法|结果|样本|数量|统计)|\b(?:each|every) (?:paper|study)\b/i.test(q);
 // The research workspace has three retrieval families only. Screening and
 // exhaustive per-paper questions share the balanced multi-paper pipeline;
 // they do not fall back to a global Top-K competition between papers.
 return comparison||selection||exhaustive
  ?{kind:'multi-compare',route:'coverage',task:comparison?'compare':'screen',scopeIds:ids}
  :{kind:'local-fact',route:'relevance',task:'fact',scopeIds:ids};
}
