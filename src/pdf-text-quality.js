// Conservative text-layer checks; this is not OCR and does not establish that
// every table/formula survived extraction. Coherent non-Latin papers are valid.
const unfamiliarScripts=['Devanagari','Bengali','Gurmukhi','Gujarati','Oriya','Tamil','Telugu','Kannada','Malayalam','Sinhala','Thai','Lao','Tibetan','Myanmar','Georgian','Armenian','Ethiopic','Khmer','Mongolian','Canadian_Aboriginal','Cherokee'];
const scriptPatterns=unfamiliarScripts.map(name=>[name,new RegExp(`\\p{Script=${name}}`,'gu')]);
const count=(text,pattern)=>(text.match(pattern)||[]).length;
const unmappedSymbols=/[\u0000-\u0008\u000b\u000e-\u001f\u007f-\u009f\ufffd\p{Co}]/gu;
// Never guess whether a missing glyph was a minus, inequality or other operator.
export function readablePdfPage(text) {
  return String(text||'').replace(unmappedSymbols,'[unmapped PDF symbol]');
}

export function assessPdfTextQuality(pageTexts=[]) {
  const pages=pageTexts.map((value,index)=>{
    const text=String(value||''),visible=count(text,/\S/gu),letters=count(text,/\p{L}/gu),han=count(text,/\p{Script=Han}/gu),latin=count(text,/\p{Script=Latin}/gu);
    const controls=count(text,/[\u0000-\u0008\u000b\u000e-\u001f\u007f-\u009f]/g),replacements=count(text,/\ufffd/g),privateUse=count(text,/\p{Co}/gu);
    const scripts=Object.fromEntries(scriptPatterns.map(([name,pattern])=>[name,count(text,pattern)]).filter(([,amount])=>amount));
    const majorUnexpectedScripts=Object.values(scripts).filter(amount=>amount>=20&&amount/Math.max(1,letters)>=.06).length;
    return {page:index+1,visible,letters,han,latin,controls,replacements,privateUse,majorUnexpectedScripts,scripts};
  });
  const first=pages.find(page=>page.letters>=200);
  const beginsClearlyChinese=Boolean(first&&first.han>=200&&first.han/first.letters>=.7&&(first.letters-first.han-first.latin)/first.letters<.15);
  const brokenCharacters=pages.filter(page=>page.visible>=120&&(
    page.replacements>=24&&page.replacements/page.visible>=.08||
    page.controls>=24&&page.controls/page.visible>=.08||
    page.privateUse>=40&&page.privateUse/page.visible>=.15
  ));
  // Broken Unicode maps can turn Chinese into a mixture of unrelated scripts
  // without producing U+FFFD. Require both a clear readable Chinese lead and
  // multiple long, mixed-script pages; Hindi/Tamil documents do not meet this.
  const mixedMapping=beginsClearlyChinese?pages.filter(page=>page.page>first.page&&page.letters>=200&&page.han/page.letters<.04&&(page.letters-page.han-page.latin)/page.letters>.65&&page.majorUnexpectedScripts>=3):[];
  const brokenPages=[...new Set([...brokenCharacters,...(mixedMapping.length>=2?mixedMapping:[])].map(page=>page.page))].sort((a,b)=>a-b);
  const uncertainPages=pages.filter(page=>page.controls||page.replacements||page.privateUse).map(page=>page.page);
  return {usable:brokenPages.length===0,reason:brokenPages.length?'unreliable_unicode_mapping':null,affectedPages:brokenPages,uncertainPages,pages};
}
