// Paragraph-first source chunks. Offsets refer to LF-normalized, otherwise unmodified MD.
export const CHUNK_VERSION='paragraph-v3';
export const fingerprint=text=>{let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return (a>>>0).toString(16)+(b>>>0).toString(16);};
export const terms=text=>String(text).normalize('NFKC').toLowerCase().match(/[a-z0-9]+(?:[-'][a-z]+)*|[\u3400-\u9fff]{1,2}/g)||[];
function headingSection(text){
 const value=text.replace(/^#+\s*|^[\d.]+\s*/g,'').trim();if(value.length>90)return null;
 for(const [section,re] of Object.entries({abstract:/^(abstract|摘要)(?:\b|$)/i,methods:/^(method(?:s|ology)?|materials? and methods|participants?|procedure|experimental design|方法|研究方法|被试|参与者)(?:\b|$)/i,results:/^(results?|findings?|结果)(?:\b|$)/i,discussion:/^(general discussion|discussion|讨论)(?:\b|$)/i,limitations:/^(limitations?|局限)(?:\b|$)/i,conclusion:/^(conclusions?|结论)(?:\b|$)/i,introduction:/^(introduction|background|引言|背景)(?:\b|$)/i,references:/^(references|bibliography|参考文献)(?:\b|$)/i}))if(re.test(value))return section;
 return null;
}
export function chunkDocument(document,node={},maxChars=1400){
 const source=String(document.markdown||'').replace(/\r\n/g,'\n'),version=fingerprint(source),lines=source.split('\n'),offsets=[];let offset=0;
 for(const line of lines){offsets.push(offset);offset+=line.length+1;}
 const chunks=[];let start=null,page=null,section='unknown',heading='';
 const lineAt=pos=>{let l=0,r=offsets.length;while(l<r){const m=(l+r)>>1;if(offsets[m]<=pos)l=m+1;else r=m;}return Math.max(1,l);};
 const push=(a,b)=>{
  while(a<b&&/\s/.test(source[a]))a++;while(b>a&&/\s/.test(source[b-1]))b--;
  while(b>a){let end=b;
   if(b-a>maxChars){const segment=source.slice(a,a+maxChars),boundaries=[...segment.matchAll(/[.!?](?:["”’)]*)\s+|[。！？]|;\s+|；/g)].map(m=>m.index+m[0].length),boundary=boundaries.filter(p=>p>=maxChars*.45).at(-1),newline=segment.lastIndexOf('\n'),space=segment.lastIndexOf(' ');end=a+(boundary||(newline>maxChars*.45?newline:space>maxChars*.45?space:maxChars));}
   let right=end;while(right>a&&/\s/.test(source[right-1]))right--;
   if(right>a)chunks.push({chunkId:`${node.id||'attachment'}:${CHUNK_VERSION}:${version}:${a}-${right}`,documentId:node.id,title:node.title||document.fileName,authors:node.authors||[],year:node.year,doi:node.doi||'',section,heading,page,lineStart:lineAt(a),lineEnd:lineAt(right-1),startOffset:a,endOffset:right,text:source.slice(a,right),fileName:document.fileName,localMarkdownPath:document.localMarkdownPath,sourceKind:document.sourceKind||'markdown',contentHash:version,chunkVersion:CHUNK_VERSION});
   a=end;while(a<b&&/\s/.test(source[a]))a++;
  }
 };
 const flush=end=>{if(start!==null)push(start,end);start=null;};
 lines.forEach((line,i)=>{const marker=line.match(/^## PDF Page (\d+)\s*$/);if(marker){flush(offsets[i]);page=Number(marker[1]);return;}const detected=headingSection(line),isHeading=detected||/^#{1,6}\s+/.test(line);if(isHeading){flush(offsets[i]);if(detected)section=detected;heading=line.replace(/^#+\s*/,'').trim();}if(!line.trim()){flush(offsets[i]);return;}if(start===null)start=offsets[i];});flush(source.length);
 // PDF extraction often inserts blank lines between individual lines. Merge
 // adjacent short paragraphs, never crossing a page or section/heading boundary.
 // Slice the original source so evidence offsets and quotations remain exact.
 const merged=[];
 for(const chunk of chunks){const previous=merged.at(-1);
  if(previous&&previous.page===chunk.page&&previous.section===chunk.section&&previous.heading===chunk.heading&&(previous.text.length<600||chunk.text.length<120)&&chunk.endOffset-previous.startOffset<=maxChars){
   previous.endOffset=chunk.endOffset;previous.lineEnd=chunk.lineEnd;previous.text=source.slice(previous.startOffset,chunk.endOffset);
   previous.chunkId=`${node.id||'attachment'}:${CHUNK_VERSION}:${version}:${previous.startOffset}-${chunk.endOffset}`;
  }else merged.push({...chunk});
 }
 return merged;
}
export function makeCandidates(documents){return documents.flatMap(({node,document})=>document?.markdown?.trim()?chunkDocument(document,node):node.abstract?.trim()?[{chunkId:`${node.id}:abstract:${fingerprint(node.abstract)}`,documentId:node.id,title:node.title,authors:node.authors||[],year:node.year,section:'abstract',text:node.abstract,sourceKind:'abstract',startOffset:0,endOffset:node.abstract.length}]:[]);}
export function explicitTargets(documents,question){const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');const q=norm(question);return documents.filter(({node})=>(norm(node.title).length>12&&q.includes(norm(node.title)))||(node.doi&&q.includes(norm(node.doi)))).map(x=>x.node.id);}
export function lexicalRank(candidates,query){
 const stop=new Set('a an the and or of in to is are for with this that what which how please paper study'.split(' ')),qt=[...new Set(terms(query).filter(t=>!stop.has(t)))],tokenized=candidates.map(c=>terms(c.text)),avg=tokenized.reduce((n,t)=>n+t.length,0)/Math.max(1,candidates.length),df=new Map();
 for(const tokens of tokenized)for(const t of new Set(tokens))df.set(t,(df.get(t)||0)+1);
 return candidates.map((chunk,i)=>{const tf=new Map();for(const t of tokenized[i])tf.set(t,(tf.get(t)||0)+1);let score=0;for(const t of qt){const f=tf.get(t)||0;score+=Math.log(1+(candidates.length-(df.get(t)||0)+.5)/((df.get(t)||0)+.5))*f*2.2/(f+1.2*(.25+.75*tokenized[i].length/Math.max(1,avg)));}return {chunk,score};}).sort((a,b)=>b.score-a.score);
}
export function selectEvidence(documents,question,budget=42000){
 const targets=explicitTargets(documents,question),all=makeCandidates(documents),candidates=targets.length?all.filter(c=>targets.includes(c.documentId)):all;
 const expanded=question+' '+Object.entries({'方法':'methods participants procedure task','样本':'sample participants patients controls','结果':'results findings','多少':'sample mean number total','结论':'conclusion discussion','观察':'observation audience','差异':'difference comparison group'}).filter(([k])=>question.includes(k)).map(([,v])=>v).join(' ');
 return packEvidence(lexicalRank(candidates,expanded).map(r=>r.chunk),budget,Math.max(24,targets.length*6),targets);
}
export function packEvidence(ranked,budget,topK,targets=[]){
 const selected=[],seen=new Set();let used=0;
 const add=c=>{if(!c||seen.has(c.chunkId)||selected.length>=topK||used+c.text.length>budget)return;seen.add(c.chunkId);used+=c.text.length;selected.push(c);};
 if(targets.length>1)for(let i=0;i<Math.floor(topK/targets.length);i++)for(const target of targets)add(ranked.filter(c=>c.documentId===target)[i]);
 for(const c of ranked)add(c);return selected.map((c,i)=>({...c,id:`E${i+1}`,truncated:false}));
}
export function validateEvidenceAnswer(answer,evidence){const ids=[...new Set([...answer.matchAll(/\[(E\d+)\]/g)].map(m=>m[1]))],known=new Map(evidence.map(e=>[e.id,e]));if(ids.some(id=>!known.has(id)))throw new Error('模型引用了不存在的证据编号，请重试。 / Unknown evidence ID.');return ids.map(id=>known.get(id));}
// Quotes are sliced from the retrieved original, never composed by the model.
// Chinese uses word segmentation; English keeps punctuation and original casing.
export function evidenceOpening(text, limit=10) {
 const source=String(text||'').replace(/^#{1,6}[^\n]*\n/gm,'').trim();
 if(!source)return '';
 const sentence=[...new Intl.Segmenter(undefined,{granularity:'sentence'}).segment(source)][0]?.segment.trim()||source;
 const words=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Thai}]/u.test(sentence)
  ? [...new Intl.Segmenter(undefined,{granularity:'word'}).segment(sentence)].filter(s=>s.isWordLike)
  : [...sentence.matchAll(/\S+/g)].filter(s=>/[\p{L}\p{N}]/u.test(s[0]));
 return words.length>limit?sentence.slice(0,words[limit].index).trimEnd()+'...':sentence;
}
const escapeQuote=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/([\\`*_{}\[\]])/g,'\\$1').replace(/\s+/g,' ');
export function evidenceLocations(answer,evidence,language='zh'){const sources=validateEvidenceAnswer(answer,evidence);if(!sources.length)return answer;return answer+'\n\n'+(language==='en'?'Sources:':'证据来源：')+'\n\n'+sources.map(e=>`- [${e.id}] ${e.title||e.fileName} · ${e.section||'unknown'} · ${e.page?(language==='en'?`PDF page ${e.page}`:`PDF 第 ${e.page} 页`):(language==='en'?'Markdown':'MD')} · ${language==='en'?'lines':'行'} ${e.lineStart||1}–${e.lineEnd||1}${e.text?`\n  ${language==='en'?'Original':'原句'}：“${escapeQuote(evidenceOpening(e.text))}”`:''}`).join('\n');}
