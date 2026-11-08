import { readablePdfPage } from './pdf-text-quality.js';

export const PDF_BIBLIOGRAPHY_VERSION = 1;
export const BIBLIOGRAPHY_PAGES = 8;
const tidy = text => readablePdfPage(String(text || '')).normalize('NFKC').trim();

// PDF stream order often differs from visual order. Keep a separate, bounded
// layout for bibliography extraction; never reorder the cited full-text lines.
export function bibliographyPage(page, items, number) {
  const unique = new Map();
  for (const item of items) {
    if (!('str' in item) || !item.str.trim() || !item.transform) continue;
    const x=item.transform[4],y=item.transform[5],size=Math.hypot(item.transform[2],item.transform[3]);
    if (![x,y,size].every(Number.isFinite)) continue;
    const text=tidy(item.str),key=`${Math.round(y)}:${text}`,copies=unique.get(key)||[];
    if(!copies.some(previous=>Math.abs(previous.x-x)<1&&Math.abs(previous.y-y)<1))copies.push({text,x,y,size,width:Number(item.width)||0});
    unique.set(key,copies);
  }
  const rows=[];
  for(const item of [...unique.values()].flat().sort((a,b)=>b.y-a.y||a.x-b.x)){
    let row=rows.findLast(line=>Math.abs(line.y-item.y)<=Math.min(3,Math.max(1.5,item.size*.28)));
    if(!row){row={y:item.y,items:[]};rows.push(row);}
    row.items.push(item);
  }
  const segments=rows.sort((a,b)=>b.y-a.y).flatMap(row=>{
    const groups=[];
    for(const item of row.items.sort((a,b)=>a.x-b.x)){
      const group=groups.at(-1),previous=group?.at(-1),gap=previous?item.x-previous.x-previous.width:0;
      const differentSize=previous&&Math.max(item.size,previous.size)>Math.min(item.size,previous.size)*1.6;
      if(!group||gap>Math.max(item.size,previous.size)*5||differentSize&&gap>Math.min(item.size,previous.size)*1.5)groups.push([item]);else group.push(item);
    }
    return groups.map(items=>({y:row.y,items}));
  });
  const lines=segments.map(row=>{
    const sorted=row.items,sizes=sorted.filter(i=>/[\p{L}\p{N}]/u.test(i.text)).map(i=>i.size).sort((a,b)=>a-b);
    let text='',previous;
    for(const item of sorted){
      const gap=previous?item.x-previous.x-previous.width:0;
      const cjk=previous&&/[\p{Script=Han}]$/u.test(previous.text)&&/^[\p{Script=Han}]/u.test(item.text);
      const separator=!previous?'':gap>Math.max(item.size,previous.size)*.85?'  ':cjk&&gap<item.size*.6?'':' ';
      text+=separator+item.text;previous=item;
    }
    return {text:text.trim(),size:Math.round((sizes[Math.floor(sizes.length/2)]||0)*100)/100,x:Math.round(sorted[0].x*100)/100,y:Math.round(row.y*100)/100};
  }).filter(line=>line.text).slice(0,350);
  return {page:number,width:page.view?.[2]||page.width||0,height:page.view?.[3]||page.height||0,lines};
}

export function bibliographyInfo(metadata={}) {
  const get=key=>metadata.metadata?.get?.(key);
  return { title:String(get('dc:title')||metadata.info?.Title||'').slice(0,1500),
    authors:get('dc:creator')||metadata.info?.Author||'',
    publicationDate:String(get('prism:publicationDate')||get('prism:coverDate')||'').slice(0,100) };
}

export function bibliographyText(bibliography) {
  if(bibliography?.version!==PDF_BIBLIOGRAPHY_VERSION||!Array.isArray(bibliography.pages))return '';
  return bibliography.pages.slice(0,BIBLIOGRAPHY_PAGES).map(page=>`## PDF Page ${page.page}\n${page.lines.map(line=>line.text).join('\n')}`).join('\n');
}

// Also used on the local-service boundary: accept bounded text and geometry,
// never arbitrary PDF metadata, filesystem paths, or executable expressions.
export function sanitizeBibliography(input) {
  if(input?.version!==PDF_BIBLIOGRAPHY_VERSION||!Array.isArray(input.pages))return null;
  const numeric=value=>Number.isFinite(Number(value))?Number(value):0;
  const result={version:PDF_BIBLIOGRAPHY_VERSION,info:{title:String(input.info?.title||'').slice(0,1500),
    authors:(Array.isArray(input.info?.authors)?input.info.authors:[input.info?.authors]).filter(x=>typeof x==='string').slice(0,100).map(x=>x.slice(0,300)),
    publicationDate:String(input.info?.publicationDate||'').slice(0,100)},
    pages:input.pages.slice(0,BIBLIOGRAPHY_PAGES).map((page,index)=>({page:Math.max(1,numeric(page.page)||index+1),width:numeric(page.width),height:numeric(page.height),
      lines:(Array.isArray(page.lines)?page.lines:[]).slice(0,350).map(line=>({text:String(line.text||'').slice(0,2000),size:numeric(line.size),x:numeric(line.x),y:numeric(line.y)}))}))};
  if(input.ocr){result.ocr={attempted:input.ocr.attempted===true,supported:input.ocr.supported===true};
    result.ocrPages=sanitizeBibliography({version:PDF_BIBLIOGRAPHY_VERSION,pages:Array.isArray(input.ocrPages)?input.ocrPages.slice(0,3):[]}).pages;}
  return result;
}

export function ocrBibliographyPage(lines,width,height,number){
  return bibliographyPage({width,height},lines.map(line=>({str:line.text,transform:[line.height,0,0,line.height,line.x,height-line.y],width:line.width})),number);
}
