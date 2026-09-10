import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function messageMarkdown(text){
  const html=marked.parse(String(text||''),{gfm:true,breaks:true,async:false});
  const safe=DOMPurify.sanitize(html,{ALLOWED_TAGS:['p','br','strong','em','del','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','pre','code','hr','table','thead','tbody','tr','th','td','a'],ALLOWED_ATTR:['href','title','start'],ALLOW_DATA_ATTR:false});
  const template=document.createElement('template');template.innerHTML=safe;
  for(const link of template.content.querySelectorAll('a')){
    const href=link.getAttribute('href')||'';
    if(!/^https?:\/\//i.test(href))link.removeAttribute('href');
    else{link.target='_blank';link.rel='noopener noreferrer';}
  }
  return template.innerHTML;
}
