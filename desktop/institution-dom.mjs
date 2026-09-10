// These functions deliberately close over no module state. The native institution
// browser evaluates their source in its authenticated renderer (including frames).
// Only observed controls/URLs are used: no inferred institution search endpoints.
export function institutionDomSnapshot() {
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const visible = element => Boolean(element && element.getClientRects().length && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none' && !element.closest('[hidden],[aria-hidden="true"]'));
  const roots = [document];
  for (let i = 0; i < roots.length && roots.length < 32; i++) {
    for (const element of roots[i].querySelectorAll('*')) if (element.shadowRoot && roots.length < 32) roots.push(element.shadowRoot);
  }
  const all = (selector, scope) => {
    const found = [];
    for (const root of scope ? [scope] : roots) found.push(...root.querySelectorAll(selector));
    return found;
  };
  const text = element => clean(element?.innerText || element?.textContent);
  const href = value => { try { const url = new URL(value, location.href); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; } };
  const tokenFor = (element, kind) => {
    if (!element) return null;
    let token = element.getAttribute('data-litgraph-action');
    if (!token) {
      let number = 1;
      const used = new Set(all('[data-litgraph-action]').map(item => item.getAttribute('data-litgraph-action')));
      while (used.has(`${kind}-${number}`)) number++;
      token = `${kind}-${number}`; element.setAttribute('data-litgraph-action', token);
    }
    return token;
  };
  const blocked = element => {
    if (element.closest('nav,footer,[role="navigation"],.references,.reference-list,#references,[data-testid*="reference"],.related-articles,.recommended-articles,.recommendations,.advertisement,[role="complementary"]')) return true;
    // A semantic <header> inside an article/result is a legitimate title block;
    // only the page-level header is navigation rather than research evidence.
    const header = element.closest('header');
    return Boolean(header && !header.closest('article,.result-item,.search-result,.resultItem,[role="listitem"]'));
  };
  const actionLabel = value => /^(?:(?:download|view|open|read|show|access)\s+(?:the\s+)?(?:full[- ]?text|article|pdf|abstract|record)(?:\s+(?:online|pdf|html|in a new tab))?|(?:full[- ]?text(?:\s+available)?|available online|pdf|abstract|download|online access|view online|cite|citation|export|references|related articles|save|share|details)|(?:下载|查看|阅读|获取|打开)(?:全文|摘要|PDF|详情|记录)?|全文|摘要|引用|收藏|分享)$/i.test(clean(value));
  const doiFrom = value => { let decoded = String(value || ''); try { decoded = decodeURIComponent(decoded); } catch {} return decoded.match(/\b10\.\d{4,9}\/[^\s<>"?#]+/i)?.[0]?.replace(/[.,;)}\]]+$/, '') || ''; };
  const yearFrom = value => Number(clean(value).match(/\b(?:18|19|20)\d{2}\b/)?.[0]) || null;
  const labelOf = element => clean([element.getAttribute('aria-label'), element.getAttribute('title'), text(element)].filter(Boolean).join(' '));
  const host = location.hostname.toLowerCase();
  let platform = 'generic';
  if (all('prm-search,prm-search-bar,prm-brief-result-container,prm-full-view,[id^="SEARCH_RESULT_RECORDID_"],#searchResultsContainer').length || /exlibrisgroup|primo\.exlibris|\/discovery\/(?:search|fulldisplay)/i.test(location.href)) platform = 'primo';
  else if (/sciencedirect/.test(host) || all('.ResultItem,.result-list-container').length) platform = 'sciencedirect';
  else if (/springer/.test(host)) platform = 'springer';
  else if (/nature\.com/.test(host)) platform = 'nature';
  else if (/wiley/.test(host)) platform = 'wiley';
  else if (/tandfonline/.test(host)) platform = 'taylor-francis';
  else if (/sagepub/.test(host)) platform = 'sage';
  else if (/ieeexplore/.test(host)) platform = 'ieee';
  else if (/cnki/.test(host)) platform = 'cnki';
  else if (/ebsco/.test(host) || all('.result-list-li,.record-formats-wrapper').length) platform = 'ebsco';
  else if (/proquest/.test(host) || all('.resultItem,.resultTitle').length) platform = 'proquest';

  // Password/account forms are never treated as a literature search form, even
  // when their fields happen to be called "query" or their buttons say "Go".
  const safeSearch = input => {
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    if (!visible(input) || input.disabled || input.readOnly || !['text', 'search', ''].includes(type) && input.tagName !== 'TEXTAREA') return false;
    if (/password|username|email|one-time-code/i.test(input.getAttribute('autocomplete') || '')) return false;
    if (/password|username|email|account|captcha|verification|验证码|账号|邮箱/i.test([input.name, input.id, input.placeholder, input.getAttribute('aria-label')].join(' '))) return false;
    return !input.form?.querySelector('input[type="password"],input[autocomplete="username"],input[autocomplete="current-password"],input[autocomplete="one-time-code"]');
  };
  const searchScore = input => {
    if (!safeSearch(input)) return 0;
    const label = [input.type, input.name, input.id, input.placeholder, input.getAttribute('aria-label'), ...Array.from(input.labels || []).map(text)].join(' ');
    let score = /search|query|keyword|\bqs\b|检索|搜索|关键词/i.test(label) ? 4 : /^(q|s|text)$/i.test(input.name) ? 2 : 0;
    if (score && input.type === 'search') score += 2;
    if (score && input.closest('prm-search-bar,[role="search"],.search-bar,.searchBar,.search-input-container')) score += 2;
    if (score && /within|refine|filter|结果内|筛选/i.test(label)) score -= 3;
    return score;
  };
  const searchInput = all('input,textarea').filter(input => searchScore(input) > 0).sort((a, b) => searchScore(b) - searchScore(a))[0];
  const searchLabel = searchInput ? clean([searchInput.getAttribute('aria-label'), searchInput.placeholder, ...Array.from(searchInput.labels || []).map(text)].filter(Boolean).join(' ')) : '';
  const search = searchInput ? {token: tokenFor(searchInput, 'search'), value: searchInput.value || '', label: searchLabel, catalogue: /catalog|discover|literature|publication|journal|article|primo|文献|论文|馆藏/i.test(searchLabel)} : null;

  const cardSelector = [
    'prm-brief-result-container', '[id^="SEARCH_RESULT_RECORDID_"]', '.list-item-wrapper',
    '.ResultItem', '.result-item', '.resultItem', '.result-list-li', '.search-result', '.searchResult', '.search-result-item',
    '.search-results__item', '.app-card-open', '.c-card', '.issue-item', '.search__item', '.item__body',
    '[data-testid*="search-result"]', '[data-test*="search-result"]', '[data-testid="result"]', '[data-testid="result-item"]',
    '[data-test="result"]', '[data-testid="search-result-card"]', '[data-auto="result-list-entry"]',
    'xpl-results-item', '.GridTableContent tbody tr', 'table.result-table-list tbody tr', 'article'
  ].join(',');
  const headingSelector = 'h1 a[href],h2 a[href],h3 a[href],h4 a[href],[role="heading"] a[href],a[data-title],a.result-list-title-link,a.resultTitle,a.title,a.title-link,a.doc-title,a.fz14,a[data-testid="result-title-a"],.search-hit-title a[href],.hlFld-Title a[href],.item__title a[href],.briefTitle a[href],prm-brief-result a[href]';
  const resultRootSelector = 'prm-search-result-list,#searchResultsContainer,#mainResults,[data-testid="search-results"],.search-results,.searchResults,.results-container,.result-list,.results-list,#results';
  // Observe actual result records, not the search input, URL, count label, ads or
  // our token attributes. This proves that a same-query SPA refresh committed a
  // new result view even when it replaced cards with identical text and URLs.
  const revisionKey = Symbol.for('litgraph.institution.result-revision');
  let revisionState = globalThis[revisionKey];
  if (!revisionState) {
    revisionState = {revision: 0, cards: new WeakSet(), containers: new WeakSet(), cardNodes: [], roots: new WeakSet()};
    const ancestorMarked = (node, set) => {
      for (let element = node?.nodeType === 1 ? node : node?.parentElement; element; element = element.parentElement) if (set.has(element)) return true;
      return false;
    };
    const containsOldCard = node => node?.nodeType === 1 && revisionState.cardNodes.some(card => node === card || node.contains(card));
    const nestedCard = node => node?.nodeType === 1 && (node.matches(cardSelector) || node.querySelector(cardSelector));
    const nestedRoot = node => node?.nodeType === 1 && (node.matches(resultRootSelector) ? node : node.querySelector(resultRootSelector));
    const meaningful = node => node?.nodeType === 1 ? !node.matches('script,style,input,textarea,button,[role="status"],[role="progressbar"],.loading-spinner,.search-loading,.results-loading') && !blocked(node) : Boolean(clean(node?.textContent));
    revisionState.consume = records => {
      const committed = records.some(record => {
        if (record.type === 'characterData') return meaningful(record.target) && ancestorMarked(record.target, revisionState.cards) && !blocked(record.target.parentElement);
        if (record.type !== 'childList') return false;
        const nodes = [...record.addedNodes, ...record.removedNodes];
        if (nodes.some(node => containsOldCard(node))) return true;
        if (ancestorMarked(record.target, revisionState.cards) && nodes.some(meaningful) && !blocked(record.target.nodeType === 1 ? record.target : record.target.parentElement)) return true;
        if (ancestorMarked(record.target, revisionState.containers) && nodes.some(node => meaningful(node) && nestedCard(node))) return true;
        return [...record.addedNodes].some(node => {const region = nestedRoot(node); return region && !blocked(region) && nestedCard(region);});
      });
      if (committed) revisionState.revision++;
    };
    revisionState.observer = new MutationObserver(revisionState.consume);
    globalThis[revisionKey] = revisionState;
  }
  revisionState.consume(revisionState.observer.takeRecords());
  for (const root of roots) if (!revisionState.roots.has(root)) {
    revisionState.roots.add(root); revisionState.observer.observe(root, {childList: true, characterData: true, subtree: true});
  }
  const observedCards = all(cardSelector).filter(visible).filter(card => !blocked(card));
  for (const card of observedCards) revisionState.cards.add(card);
  revisionState.cardNodes = observedCards.slice(0, 500);
  for (const region of all(resultRootSelector)) revisionState.containers.add(region);
  const isRecordUrl = value => { try {
    const url = new URL(value); const path = decodeURIComponent(url.pathname);
    // Exclusions are path segments/actions, never arbitrary query text. Primo
    // legitimately includes "CitationCount" in normal article record IDs.
    if (/\/(?:references|citations|supplements|supplementary|export|pdf|epdf|pdfdirect|pdfft)(?:\/|$)|\.pdf$/i.test(path)) return false;
    return /\/(?:science\/article\/pii|articles?|doi|document|record|records|docview|discovery\/fulldisplay|details)(?:\/|$)/i.test(path) || /(?:^|[?&])(?:docid|recordid|recordId|an|dbcode|filename)=/i.test(url.search) || /\/kcms[^/]*\/.*(?:detail|article)/i.test(path);
  } catch { return false; } };
  const validTitle = value => value.length >= (/[\u3400-\u9fff]/.test(value) ? 4 : 8) && value.length <= 1800 && !actionLabel(value) && !/^(?:sign in|log in|register|my account|advanced search|search results|next page|previous page|登录|注册|高级检索)$/i.test(value);
  const papers = new Map();
  const extract = (anchor, card, explicitHeading = false) => {
    if (!visible(anchor) || blocked(anchor)) return;
    const sourceUrl = href(anchor.getAttribute('href'));
    const title = clean(anchor.getAttribute('data-title') || text(anchor) || anchor.getAttribute('aria-label'));
    if (!sourceUrl || !validTitle(title) || (!explicitHeading && !isRecordUrl(sourceUrl))) return;
    if (explicitHeading && card.tagName === 'ARTICLE' && !isRecordUrl(sourceUrl) && !/(?:result|search|card|issue-item)/i.test(card.className || '') && !card.closest('#searchResultsContainer,#mainResults,.search-results,.results-container,#results') && !/(?:\/search(?:\/|\?|$)|\/results(?:\/|\?|$)|[?&](?:q|query|search|keyword|qs)=)/i.test(location.href)) return;
    // A heading anchor is trusted only inside a result/card, not a homepage's
    // account/help heading or a references/recommendations panel.
    if (/^(?:home|about|contact|help|news|privacy|cookie|terms|login|register)(?:\b|\/)/i.test(new URL(sourceUrl).pathname.replace(/^\//, ''))) return;
    const cardText = text(card);
    const specificText = selector => all(selector, card).filter(visible).map(text).filter(Boolean);
    const doiLink = all('a[href]', card).map(a => a.href).find(value => /(?:doi\.org\/10\.|\/doi\/(?:abs\/|full\/)?10\.)/i.test(value));
    const doi = doiFrom(sourceUrl) || doiFrom(card.getAttribute('data-doi')) || doiFrom(doiLink) || doiFrom(cardText);
    const dateText = specificText('time,[itemprop="datePublished"],.year,.date,.publication-date,.publication-year,.published-date,[data-testid*="date"]')[0] || cardText;
    const authorElements = all('[itemprop="author"],.authors,.author-list,.authors-list,.author,.creator,.creators,.authorField,[data-testid*="author"],prm-brief-result-container .media-content-type-and-more .creator', card).filter(visible);
    const authors = [...new Set(authorElements.map(text).filter(value => value && value.length < 1500))].flatMap(value => value.split(/\s*;\s*/).filter(Boolean));
    const journal = specificText('[itemprop="isPartOf"],.journal-title,.journal-name,.source-title,.source,[data-testid="journal-title"]')[0] || '';
    const abstract = specificText('[itemprop="abstract"],.abstract,.result-abstract,.snippet,[data-testid*="abstract"]')[0] || '';
    const links = all('a[href]', card).filter(visible);
    const pdf = links.find(a => /\bpdf\b|PDF全文|PDF下载/i.test(labelOf(a)) && !/supplement|supporting|附件|补充/i.test(labelOf(a)));
    const fulltext = links.find(a => /full[- ]?text|view online|online access|available online|access online|全文|在线获取/i.test(labelOf(a)) && a !== anchor);
    const paper = {title, sourceUrl, doi, year: yearFrom(dateText)};
    if (authors.length) paper.authors = authors;
    if (journal) paper.journal = journal;
    if (abstract) paper.abstract = abstract;
    if (pdf && href(pdf.getAttribute('href'))) paper.pdfUrl = href(pdf.getAttribute('href'));
    if (fulltext && href(fulltext.getAttribute('href'))) paper.fulltextUrl = href(fulltext.getAttribute('href'));
    const language = card.getAttribute('lang') || card.querySelector('[itemprop="inLanguage"]')?.getAttribute('content');
    if (language) paper.language = language;
    const type = specificText('[itemprop="additionalType"],.content-type,.publication-type,.result-type,[data-testid="article-type"]')[0];
    if (type) paper.type = type;
    const previous = papers.get(sourceUrl);
    if (!previous || Object.keys(paper).length > Object.keys(previous).length) papers.set(sourceUrl, {...previous, ...paper});
  };
  const cards = observedCards;
  for (const card of cards) {
    const heading = all(headingSelector, card).find(anchor => visible(anchor) && validTitle(text(anchor)) && !blocked(anchor));
    if (heading) extract(heading, card, true);
    else {
      const anchor = all('a[href]', card).find(a => visible(a) && isRecordUrl(href(a.getAttribute('href'))) && validTitle(text(a)) && !blocked(a));
      if (anchor) extract(anchor, card);
    }
  }
  // Catalogs without card classes still expose meaningful article-title links.
  // Require a real record URL; this is not a generic extraction of every anchor.
  for (const anchor of all('a[href]').filter(visible)) {
    if (!isRecordUrl(href(anchor.getAttribute('href'))) || !validTitle(text(anchor)) || blocked(anchor)) continue;
    const card = anchor.closest(cardSelector + ',li,tr,[role="listitem"],.result,.record') || anchor.parentElement;
    if (card) extract(anchor, card);
  }

  // A title/DOI lookup can land directly on a publisher article rather than a
  // result list. Read metadata from this same document, without inventing fields.
  const meta = name => all('meta').filter(element => (element.name || element.getAttribute('property') || '').toLowerCase() === name).map(element => clean(element.content)).filter(Boolean);
  const citationTitle = meta('citation_title')[0] || meta('dc.title')[0] || '';
  const citationDoi = doiFrom(meta('citation_doi')[0] || meta('dc.identifier')[0]);
  if (!papers.size && validTitle(citationTitle) && (citationDoi || isRecordUrl(location.href))) {
    const paper = {title: citationTitle, sourceUrl: location.href, doi: citationDoi, year: yearFrom(meta('citation_publication_date')[0] || meta('citation_date')[0] || meta('dc.date')[0])};
    const authors = meta('citation_author'); if (authors.length) paper.authors = authors;
    const journal = meta('citation_journal_title')[0]; if (journal) paper.journal = journal;
    const abstract = meta('citation_abstract')[0] || meta('dc.description')[0]; if (abstract) paper.abstract = abstract;
    const pdfUrl = href(meta('citation_pdf_url')[0]); if (meta('citation_pdf_url').length && pdfUrl) paper.pdfUrl = pdfUrl;
    const language = meta('citation_language')[0]; if (language) paper.language = language;
    papers.set(paper.sourceUrl, paper);
  }
  if (!papers.size && platform === 'primo' && /\/discovery\/fulldisplay/i.test(location.pathname)) {
    const title = text(all('prm-full-view h1,prm-full-view .item-title,prm-full-view .brief-title,.full-view-inner-container h1,h1')[0]);
    if (validTitle(title)) papers.set(location.href, {title, sourceUrl: location.href, doi: '', year: null});
  }

  const resultsContainer = all(resultRootSelector)[0];
  const statusElements = all('[role="status"],.results-count,.result-count,.results-amount,.search-results-count,#results-count,#searchResultsCount,.no-results,.noResults,.no-results-message,[data-testid*="no-result"],prm-no-search-result');
  const statusText = statusElements.filter(visible).map(text).join(' ') || text(resultsContainer);
  const empty = !papers.size && /(?:\bno (?:search )?(?:results|records|articles|matches)(?:\b|\s+found)|\b0\s+(?:results|records|articles)\b|did not (?:return|match)|没有(?:找到|检索到|搜索到)|未(?:找到|检索到|搜索到)|暂无(?:结果|记录)|共\s*0\s*(?:条|篇))/i.test(statusText);
  const countText = statusText.match(/\bof\s+([\d,]+)\s+(?:results|records|articles)\b/i)?.[1] || statusText.match(/\b([\d,]+)\s+(?:results|records|articles)\b/i)?.[1] || statusText.match(/(?:共|找到|检索到)\s*([\d,]+)\s*(?:条|篇|个)/)?.[1];
  const resultCount = countText ? Number(countText.replace(/,/g, '')) : empty ? 0 : null;
  const busy = all('[aria-busy="true"],[role="progressbar"],prm-spinner,.loading-spinner,.search-loading,.results-loading,[data-testid="loading-spinner"]').some(visible);
  const nextElement = all('a[href],button,[role="button"]')
    .filter(element => visible(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true' && !element.closest('[aria-disabled="true"],.disabled,.related-articles,.recommended-articles,.recommendations,[role="complementary"]') && !element.closest('form')?.querySelector('input[type="password"],input[autocomplete="username"]'))
    .find(element => {
      const label = clean(element.getAttribute('aria-label') || element.getAttribute('title') || text(element));
      return element.getAttribute('rel') === 'next' || /^(?:(?:go to |show |load )?(?:the )?next(?:\s+(?:page|results))?|下一页|下页|后一页)$/i.test(label);
    });
  const next = nextElement ? {token: tokenFor(nextElement, 'next'), ...(nextElement.tagName === 'A' && href(nextElement.getAttribute('href')) ? {url: href(nextElement.getAttribute('href'))} : {})} : null;
  return {
    url: location.href, html: document.documentElement?.outerHTML.slice(0, 2000000) || '', readyState: document.readyState, documentId: performance.timeOrigin, resultRevision: revisionState.revision,
    hasVisiblePassword: all('input[type="password"]').some(visible),
    hasVisibleChallenge: all('.g-recaptcha,.h-captcha,.cf-turnstile,iframe[src*="challenges.cloudflare.com"],iframe[src*="hcaptcha.com"],iframe[src*="recaptcha/api"]').some(visible),
    platform, papers: [...papers.values()].slice(0, 500), empty, busy,
    resultsRecognized: Boolean(papers.size || resultsContainer || empty || resultCount !== null), resultCount, next, search
  };
}

export function institutionDomAction({kind, query, token} = {}) {
  const visible = element => Boolean(element && element.getClientRects().length && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none' && !element.closest('[hidden],[aria-hidden="true"]'));
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const roots = [document];
  for (let i = 0; i < roots.length && roots.length < 32; i++) for (const element of roots[i].querySelectorAll('*')) if (element.shadowRoot && roots.length < 32) roots.push(element.shadowRoot);
  const all = selector => roots.flatMap(root => [...root.querySelectorAll(selector)]);
  const element = all('[data-litgraph-action]').find(item => item.getAttribute('data-litgraph-action') === token);
  if (!element || !visible(element) || element.disabled || element.getAttribute('aria-disabled') === 'true' || element.closest('[aria-disabled="true"],.disabled')) return {ok: false, reason: 'control-unavailable'};
  if (kind === 'next') {
    const label = clean(element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText || element.textContent);
    if (element.getAttribute('rel') !== 'next' && !/^(?:(?:go to |show |load )?(?:the )?next(?:\s+(?:page|results))?|下一页|下页|后一页)$/i.test(label)) return {ok: false, reason: 'control-changed'};
    if (element.tagName === 'A') { try { if (!/^https?:$/.test(new URL(element.href, location.href).protocol)) return {ok: false, reason: 'invalid-link'}; } catch { return {ok: false, reason: 'invalid-link'}; } }
    element.click(); return {ok: true, method: 'click'};
  }
  if (kind !== 'search' || !['INPUT', 'TEXTAREA'].includes(element.tagName) || element.readOnly || !String(query || '').trim()) return {ok: false, reason: 'invalid-search'};
  const form = element.form;
  if (element.tagName === 'INPUT' && !['text', 'search', ''].includes((element.getAttribute('type') || 'text').toLowerCase()) || /password|username|email|account|captcha|verification|验证码|账号|邮箱/i.test([element.name, element.id, element.placeholder, element.getAttribute('aria-label'), element.getAttribute('autocomplete')].join(' ')) || form?.querySelector('input[type="password"],input[autocomplete="username"],input[autocomplete="current-password"],input[autocomplete="one-time-code"]')) return {ok: false, reason: 'account-form'};
  const descriptor = Object.getOwnPropertyDescriptor(element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value');
  descriptor.set.call(element, String(query).trim());
  element.dispatchEvent(new Event('input', {bubbles: true})); element.dispatchEvent(new Event('change', {bubbles: true}));
  const isSearchButton = button => {
    if (!visible(button) || button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
    const label = clean(button.getAttribute('aria-label') || button.getAttribute('title') || button.innerText || button.textContent || button.value);
    return /^(?:(?:submit |run |start |perform |execute |new )?(?:search|find)(?:\s+(?:all|articles|publications|records|results|catalog|library|now))?|go|检索|搜索|开始检索|立即搜索)$/i.test(label) || /(?:^|[\s_-])(?:search-btn|search-button|submit-search)(?:$|[\s_-])/i.test(button.className || '');
  };
  const scopes = [];
  for (let parent = element.parentElement, depth = 0; parent && depth < 7; parent = parent.parentElement, depth++) {
    if (parent === document.body || parent === document.documentElement) break;
    scopes.push(parent); if (parent === form || parent.matches('prm-search-bar,[role="search"],header')) break;
  }
  for (const scope of scopes) {
    const button = [...scope.querySelectorAll('button,input[type="submit"],input[type="button"],[role="button"]')].find(isSearchButton);
    if (button) { button.click(); return {ok: true, method: 'click'}; }
  }
  if (form) {
    const button = all('button,input[type="submit"]').find(item => item.form === form && isSearchButton(item));
    if (button) { button.click(); return {ok: true, method: 'click'}; }
    if (typeof form.requestSubmit === 'function') { form.requestSubmit(); return {ok: true, method: 'submit'}; }
  }
  // Some Angular/catalog search components submit exclusively on Enter.
  // Dispatch to the observed input; never assign a guessed URL or click login.
  element.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true}));
  element.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true}));
  return {ok: true, method: 'enter'};
}
