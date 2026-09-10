// Follow only an article's observed access controls in the authenticated DOM.
// No publisher host is guessed and no proxy / OpenURL query is rewritten.
// These functions are serialized into a sandboxed institutional renderer.
export function institutionFullTextSnapshot() {
  const visible = element => Boolean(element.getClientRects().length && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden');
  const clean = text => String(text || '').replace(/\s+/g, ' ').trim();
  const positive = /^(?:(?:view|open|read|get|access|available|check|find|go to)\s+(?:the\s+)?)?(?:full[ -]?text(?:\s+(?:available|online|access))?|online(?:\s+(?:access|availability|full[ -]?text))?|view online|available online|access online|read online|check (?:for )?access|find it|find full[ -]?text|全文(?:获取|链接|阅读|下载)?|获取全文|在线(?:阅读|访问)|查看全文|可获取全文|可在线获取|查看在线资源)(?:\s*\([^)]{0,60}\))?$/i;
  const denied = /\b(?:supplement(?:ary)?|supporting information|reference(?:s)?|citation(?:s)?|related|recommended|buy|purchase|subscribe|sign in|log in|login|register|request (?:a )?copy|interlibrary|export|save|share|all (?:results|articles))\b|补充材料|参考文献|推荐文献|购买|订阅|登录|注册|馆际互借|导出|收藏|分享|全部下载/i;
  const scopeSelector = 'prm-alma-viewit,prm-view-online,prm-service-details,prm-full-view-service-container,.fulltext-access,.full-text-access,.online-access,.view-online,.resolver-services,#viewOnline,#viewIt,#getFullText,[data-testid*="fulltext"],[data-testid*="full-text"],[data-testid*="online-access"],[data-test*="fulltext"],[aria-label="View online"],[aria-label="Online access"]';
  const libraryRecord = /\/discovery\/fulldisplay(?:[/?#]|$)|\/docview\/|\/record(?:\/|\?|$)|\/openurl(?:[/?#]|$)|\/resolve(?:r)?(?:[/?#]|$)|\/sfx(?:[/?#]|$)/i.test(location.href) || Boolean(document.querySelector('prm-full-view,prm-alma-viewit,prm-view-online,.resolver-services'));
  const ownArticle = Boolean(document.querySelector('meta[name="citation_doi"],meta[name="citation_title"],meta[property="og:type"][content="article"]'));
  const elements = [...document.querySelectorAll('a,button,[role="button"],[role="link"]')];
  const controls = [];
  for (let index = 0; index < elements.length; index++) {
    const element = elements[index], label = clean(element.getAttribute('aria-label') || element.textContent || element.getAttribute('title'));
    if (!label || label.length > 220 || element.disabled || element.getAttribute('aria-disabled') === 'true' || !visible(element) || denied.test(label)) continue;
    if (element.closest('header,footer,nav,[role="navigation"],.references,#references,.related-articles,.recommendations,prm-recommendations,prm-citation-trail')) continue;
    const accessScope = element.closest(scopeSelector);
    // A heading-scoped fallback covers unfamiliar library / link-resolver UIs.
    // A whole main/article container is intentionally not an access section.
    const section = element.closest('section,[role="region"],fieldset');
    const heading = section?.querySelector('h1,h2,h3,h4,legend,[role="heading"]');
    const headingScope = section && positive.test(clean(heading?.textContent));
    const exact = positive.test(label);
    if (!(exact && (libraryRecord || ownArticle || accessScope || headingScope)) && !(accessScope || headingScope)) continue;
    const raw = element.getAttribute('href') || '';
    let url = '';
    if (raw && !/^javascript:/i.test(raw)) {
      try {
        const target = new URL(raw, location.href);
        if (!/^https?:$/.test(target.protocol) || target.username || target.password) continue;
        url = target.href;
      } catch { continue; }
    }
    if (!url && !(element.matches('button,[role="button"],[role="link"]') || /^javascript:/i.test(raw))) continue;
    if (url) {
      const target = new URL(url);
      if (/\/(?:logout|register|cart|purchase|subscribe|references|citations)(?:[/?#]|$)/i.test(target.pathname)) continue;
      if (/\/(?:login|signin)(?:[/?#]|$)/i.test(target.pathname)) {
        // EZProxy-style authenticated access links legitimately use /login
        // even while signed in. Follow the OBSERVED gateway, not its decoded
        // publisher URL; a remaining authentication gate stays user-operated.
        const gatewayTarget = ['url','target','dest','destination','redirect','redirect_uri','returnUrl'].some(name => {
          try { const resource = new URL(target.searchParams.get(name)); return /^https?:$/.test(resource.protocol) && !resource.username && !resource.password; } catch { return false; }
        });
        if (!gatewayTarget || !(accessScope || headingScope || exact)) continue;
      }
    }
    // Broad service containers can include help/settings buttons. Only actual
    // links to a resource or clearly labelled access/expansion buttons qualify.
    if (!url && !exact) continue;
    const token = String(index);
    element.setAttribute('data-litgraph-fulltext-control', token);
    const key = location.href + '\n' + label + '\n' + (url || token);
    controls.push({token, key, label, url, score: (exact ? 100 : 0) + (accessScope ? 30 : 0) + (headingScope ? 20 : 0) + (url ? 5 : 0)});
  }
  return controls.sort((a, b) => b.score - a.score);
}

export function clickInstitutionFullTextControl({token, label, url}) {
  const element = document.querySelector('[data-litgraph-fulltext-control="' + String(token).replace(/[^0-9]/g, '') + '"]');
  if (!element || element.disabled || !element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') return false;
  const currentLabel = String(element.getAttribute('aria-label') || element.textContent || element.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
  if (currentLabel !== label) return false;
  const raw = element.getAttribute('href') || '';
  if (url && (!raw || new URL(raw, location.href).href !== url)) return false;
  element.click();
  return true;
}
