import { pdfLinksFromHtml } from '../scripts/scholarly-service.js';

// Publisher citation metadata is authoritative. Some authenticated pages expose
// only a visible "Download PDF" anchor: accept it only when there is a single,
// unambiguous PDF candidate, never scan arbitrary PDF URLs in a reference list.
export function institutionPdfLinks(html, base, normalize=value=>value) {
  const declared=pdfLinksFromHtml(html,base,normalize);
  if(declared.length)return declared;
  const links=new Set();
  for(const match of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const label=match[2].replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim();
    if(label.length>80||!/^(?:(?:download|view|read|open|get|下载|查看|阅读|获取)\s*)?(?:(?:full[ -]?text|全文)\s*)?(?:\(?PDF\)?)(?:\s*(?:full[ -]?text|全文|下载|查看|阅读))?(?:\s*[[(]?\s*[\d.,]+\s*[kmg]?b\s*[\])]?)*$/i.test(label))continue;
    const href=match[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if(!href||/supplement|suppinfo|supporting|(?:[._-])s\d+\.pdf/i.test(href[1]||href[2]))continue;
    try{
      const candidate=new URL((href[1]||href[2]).replace(/&amp;/gi,'&'),base);
      if(!/^https?:$/.test(candidate.protocol)||candidate.href===base)continue;
      const safe=normalize(candidate.href);if(safe)links.add(safe);
    }catch{}
  }
  return links.size===1?[...links]:[];
}
