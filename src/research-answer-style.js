// Presentation only: never drop source-bearing claims, quotations or substantive
// uncertainty. Compress isolated retrieval-accounting paragraphs from providers
// that ignore the concise-answer contract. No additional model call is needed.
export const RESEARCH_ANSWER_STYLE = `Lead with the findings that answer the question, followed by their original-source citations. Do not narrate retrieval bookkeeping: counts of excerpts sent/returned, papers absent from this prompt, internal index statuses, token budgets, or old evidence IDs not reused in this turn. Do not add routine coverage/uncertainty boilerplate just because retrieval selected excerpts. Keep factual uncertainty: if a specific requested claim cannot be established, say briefly what remains unconfirmed, without claiming absence or exhaustive review. Mention genuine processing failures only briefly if they affect the requested result. If the user explicitly asks about retrieval coverage or system diagnostics, answer that question accurately. Never sacrifice source grounding for brevity.`;

export function compactResearchAnswer(answer, language='zh', {diagnostics=false}={}) {
 const text=String(answer||'');if(diagnostics)return text;
 let compressed=false;
 return text.split(/\n\s*\n/).map(paragraph=>{
  // Do not edit quoted originals, cited findings, tables, or code blocks.
  if(/[\[【]\s*E\d+|[“”「」"`]|^\s*[|]/m.test(paragraph))return paragraph;
  const mechanics=[
   /(?:送回|送入|发送|提供|返回|检索到).{0,18}(?:片段|摘录)|(?:片段|摘录).{0,15}(?:送回|送入|提供|返回)/,
   /(?:其余|仅|只有|共|未).{0,10}\d+\s*篇|\d+\s*篇.{0,12}(?:未|少量|片段|摘录)/,
   /(?:前一轮|上一轮|本次).{0,30}(?:证据编号|论文编号|编号.{0,12}片段)/,
   /fulltext_indexed_excerpts_only|source_text_available_excerpts_only/,
   /(?:excerpts?|snippets?).{0,40}(?:sent|returned|supplied)|(?:sent|returned|supplied).{0,40}(?:excerpts?|snippets?)/i,
   /(?:remaining|only)\s+\d+\s+papers|previous.{0,25}(?:evidence|citation)\s+IDs/i
  ].filter(pattern=>pattern.test(paragraph)).length;
  if(mechanics<2)return paragraph;
  // Mixed paragraphs containing a concrete finding must remain intact.
  if(/(?:结果(?:显示|表明)|研究发现|显著|p\s*[<=>]|results? (?:show|indicate)|found that)/i.test(paragraph))return paragraph;
  if(compressed)return '';compressed=true;
  return language==='en'?'Other papers may also be relevant; their inclusion still needs source verification.':'其他文献是否同样符合这一条件，尚需核对原文。';
 }).filter(p=>p.trim()).join('\n\n');
}

export const asksRetrievalDiagnostics=question=>/(?:检索|片段|摘录|索引|覆盖率|送回|送入).{0,15}(?:多少|几篇|数量|覆盖|为什么|状态)|(?:多少|几篇|为什么).{0,15}(?:检索|片段|摘录|送回|索引)|retrieval coverage|how many.{0,25}(?:excerpts|snippets)|index status/i.test(String(question||''));
