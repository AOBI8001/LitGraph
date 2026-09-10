import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {institutionDomSnapshot, institutionDomAction} from '../desktop/institution-dom.mjs';

const root = process.cwd();
await mkdir('output/desktop', {recursive: true});
const profile = await mkdtemp(path.join(root, 'output/desktop/institution-dom-'));
const env = {...process.env, LITGRAPH_DOM_TEST_DATA: profile}; delete env.ELECTRON_RUN_AS_NODE;
const fixture = http.createServer((_req, res) => {res.writeHead(200, {'Content-Type': 'text/html'}); res.end('<html><head><title>Institution DOM fixture</title></head><body></body></html>');});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${fixture.address().port}`;
let app, count = 0;
try {
  app = await electron.launch({executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: [path.join(root, 'tests/fixtures/institution-dom-app.cjs')], env, timeout: 30000});
  const page = await app.firstWindow();
  const load = async (html, pathname = '/search') => {await page.goto(origin + pathname); await page.setContent(`<style>body{font-family:sans-serif}input,button{width:160px;height:30px}article,li,section{display:block;margin:8px}prm-brief-result-container,prm-search-bar,prm-search-result-list,prm-full-view{display:block}</style>${html}`);};
  const read = () => page.evaluate(`(${institutionDomSnapshot.toString()})()`);
  const act = args => page.evaluate(`(${institutionDomAction.toString()})(${JSON.stringify(args)})`);
  const passed = label => {count++; console.log(`PASS ${label}`);};

  await load(`<prm-search-bar><input id="searchBar" aria-label="Search anything" value="old query"><button aria-label="Search" onclick="window.submitted=document.querySelector('input').value">Search</button></prm-search-bar>
    <div class="results-count">1-10 of 10 Results</div><prm-search-result-list id="searchResultsContainer">
    <prm-brief-result-container id="SEARCH_RESULT_RECORDID_cdi_webofscience_primary_001199054400001CitationCount"><h3><a href="/discovery/fulldisplay?docid=cdi_webofscience_primary_001199054400001CitationCount&vid=school">Online impulsive buying in social commerce: A mixed-methods research</a></h3><div class="authors">Xu, Haiqin; Gong, Xiang; Yan, Ruihe</div><time>2024</time><a href="/linkresolver/fulltext?docid=CitationCount">Full text available</a><a href="/download?record=1">Download PDF</a></prm-brief-result-container>
    </prm-search-result-list><button aria-label="Next page" onclick="window.nextClicked=true">→</button>`, '/discovery/search?query=any,contains,old');
  let snapshot = await read();
  assert.equal(snapshot.platform, 'primo'); assert.equal(snapshot.papers.length, 1); assert.equal(snapshot.resultCount, 10);
  assert.match(snapshot.papers[0].sourceUrl, /fulldisplay\?docid=.*CitationCount&vid=school/);
  assert.deepEqual(snapshot.papers[0].authors, ['Xu, Haiqin', 'Gong, Xiang', 'Yan, Ruihe']); assert.equal(snapshot.papers[0].year, 2024);
  assert.equal(snapshot.papers[0].pdfUrl, origin + '/download?record=1'); assert.equal(snapshot.papers[0].fulltextUrl, origin + '/linkresolver/fulltext?docid=CitationCount');
  assert.equal((await act({kind: 'search', query: 'A full title: punctuation & words', token: snapshot.search.token})).ok, true);
  assert.equal(await page.evaluate(() => window.submitted), 'A full title: punctuation & words');
  assert.equal((await act({kind: 'next', token: snapshot.next.token})).ok, true); assert.equal(await page.evaluate(() => window.nextClicked), true);
  passed('Primo full record and CitationCount, observed full text/PDF links, Angular search and button pagination');

  const cases = [
    ['Chinese short title', '<div class="search-result"><h3><a href="/record/short">青蛙行为</a></h3><time>2024</time></div>', '/record/short'],
    ['ScienceDirect', '<li class="ResultItem"><h2><a href="/science/article/pii/S0378720624000259">Open science findings in social commerce</a></h2><span class="publication-year">2024</span></li>', '/science/article/pii/S0378720624000259'],
    ['Springer', '<article class="app-card-open"><h3><a href="/article/10.1007/s00000-024-00000">Read comprehension in contemporary learning environments</a></h3><time>2024</time></article>', '/article/10.1007/s00000-024-00000'],
    ['Nature', '<li class="c-card"><h3><a href="/articles/s41586-024-01234">Climate feedback in ocean ecosystems</a></h3><time>2024</time></li>', '/articles/s41586-024-01234'],
    ['Wiley', '<div class="item__body"><h2 class="item__title"><a href="/doi/10.1002/test.123">Effects of comparative research practice</a></h2><span>2023</span></div>', '/doi/10.1002/test.123'],
    ['Taylor & Francis', '<div class="search-result"><div class="hlFld-Title"><a href="/doi/full/10.1080/test.123">Evidence from organizational behavior studies</a></div></div>', '/doi/full/10.1080/test.123'],
    ['SAGE', '<article><h3><a href="/doi/abs/10.1177/test.123">Social interaction and behavioral outcomes</a></h3></article>', '/doi/abs/10.1177/test.123'],
    ['IEEE', '<xpl-results-item><h3><a href="/document/123456">Engineering methods for comparative network analysis</a></h3></xpl-results-item>', '/document/123456'],
    ['CNKI', '<table class="result-table-list"><tbody><tr><td><a class="fz14" href="/kcms2/article/abstract?v=abc&dbcode=CJFD&filename=TEST2024">社会商务情境下消费者冲动购买行为研究</a></td><td class="author">王甲; 李乙</td><td class="date">2024-04</td></tr></tbody></table>', '/kcms2/article/abstract?v=abc&dbcode=CJFD&filename=TEST2024'],
    ['EBSCO', '<li class="result-list-li"><h3><a class="result-list-title-link" href="/detail/detail?db=bsu&an=123456">Institutional access to research articles</a></h3><span class="date">2024</span></li>', '/detail/detail?db=bsu&an=123456'],
    ['ProQuest', '<div class="resultItem"><h3><a class="resultTitle" href="/docview/123456?accountid=123">Evidence on educational information retrieval</a></h3></div>', '/docview/123456?accountid=123'],
    ['Generic library', '<section class="search-result"><h2><a href="/catalogue/item?id=123">A catalog record with an unusual institutional route</a></h2><p>2023</p></section>', '/catalogue/item?id=123']
  ];
  for (const [name, html, expected] of cases) {
    await load(`<main>${html}</main>`); snapshot = await read(); assert.equal(snapshot.papers.length, 1, name); assert.equal(snapshot.papers[0].sourceUrl, origin + expected, name); passed(`${name} observed result-card route`);
  }

  await load(`<header><a href="/article/help">Help for article search users</a></header><nav><a href="/article/account">Manage your article account</a></nav>
    <article><h3><a href="/article/real?docid=xCitationCount">Open access evidence and academic reading practices</a></h3><a href="/article/real/pdf">Download PDF</a></article>
    <section class="references"><a href="/article/reference">Related literature referenced by this paper</a></section><aside role="complementary"><article><h3><a href="/article/recommendation">A recommended but unrelated article title</a></h3></article></aside>
    <a href="/article/real">View full text</a><div hidden><article><h3><a href="/article/hidden">Hidden result must never appear</a></h3></article></div>`);
  snapshot = await read(); assert.deepEqual(snapshot.papers.map(paper => paper.title), ['Open access evidence and academic reading practices']); passed('No navigation, recommendations, reference cards, action labels or hidden-result leakage');
  await load('<article><header><h2><a href="/article/42">Research articles can use semantic header title blocks</a></h2></header></article>');
  snapshot = await read(); assert.equal(snapshot.papers.length, 1); passed('Semantic article headers remain legitimate result titles');

  await load('<div class="search-results"><div role="status">No results found for the current query</div></div>');
  snapshot = await read(); assert.equal(snapshot.empty, true); assert.equal(snapshot.resultCount, 0); assert.equal(snapshot.resultsRecognized, true); passed('Explicit empty results are recognized');
  await load('<h1>Welcome to our library</h1><p>Discover our services and collections.</p><article><h2><a href="/new-building">Our library will open a new building tomorrow</a></h2></article>', '/');
  snapshot = await read(); assert.equal(snapshot.empty, false); assert.equal(snapshot.resultsRecognized, false); passed('Unknown homepage is not reported as verified zero results');
  await load('<div class="search-results" aria-busy="true"><div role="progressbar">Loading</div></div>');
  snapshot = await read(); assert.equal(snapshot.busy, true); assert.equal(snapshot.empty, false); passed('Dynamic result loading exposes busy state');

  await load('<form id="login"><input name="query" aria-label="Search"><input type="password"><button>Search</button></form><form id="papers" onsubmit="event.preventDefault();window.sent=this.querySelector(\'input\').value"><input type="search" name="q"><button type="submit">Search</button></form>');
  snapshot = await read(); assert.equal(snapshot.hasVisiblePassword, true); assert.ok(snapshot.search); assert.equal((await act({kind: 'search', query: 'Specific paper', token: snapshot.search.token})).ok, true);
  assert.equal(await page.evaluate(() => window.sent), 'Specific paper'); assert.equal(await page.locator('#login input[name=query]').inputValue(), ''); passed('Search never types into a login form');
  await page.locator('#papers').evaluate(form => {const field = document.createElement('input'); field.type = 'password'; form.append(field);});
  assert.equal((await act({kind: 'search', query: 'Do not send', token: snapshot.search.token})).ok, false); passed('Action revalidates changed account forms');

  await load('<form id="searchForm" onsubmit="event.preventDefault();window.sent=this.querySelector(\'input\').value"><input type="search" name="q"></form><button form="searchForm" type="submit">Search</button>');
  snapshot = await read(); assert.equal((await act({kind: 'search', query: 'Associated button test', token: snapshot.search.token})).ok, true); assert.equal(await page.evaluate(() => window.sent), 'Associated button test'); passed('Search supports externally associated form submit button');
  await load('<div role="search"><input type="search" onkeydown="if(event.key===\'Enter\')window.sent=this.value"></div>');
  snapshot = await read(); assert.equal((await act({kind: 'search', query: 'Enter handler test', token: snapshot.search.token})).method, 'enter'); assert.equal(await page.evaluate(() => window.sent), 'Enter handler test'); passed('Observed custom search input supports Enter handler');

  await load('<button aria-label="Next page" disabled>Next</button><a rel="next" href="/search?page=2">2</a>'); snapshot = await read(); assert.equal(snapshot.next.url, origin + '/search?page=2');
  await page.locator('a').evaluate(a => {a.removeAttribute('rel'); a.textContent = 'Delete record';}); assert.equal((await act({kind: 'next', token: snapshot.next.token})).ok, false); passed('Disabled/stale pagination controls are not clicked');
  await load('<meta name="citation_title" content="A publisher metadata article"><meta name="citation_doi" content="10.1002/article.42"><meta name="citation_author" content="Ada Example"><meta name="citation_publication_date" content="2024/03/01"><meta name="citation_pdf_url" content="/signed/article.pdf?token=fixture"><h1>A publisher metadata article</h1>', '/doi/10.1002/article.42'); snapshot = await read(); assert.equal(snapshot.papers.length, 1); assert.equal(snapshot.papers[0].doi, '10.1002/article.42'); assert.equal(snapshot.papers[0].pdfUrl, origin + '/signed/article.pdf?token=fixture'); passed('Direct article landing reads authentic citation metadata');

  await load('<div id="component"></div>'); await page.locator('#component').evaluate(element => {element.attachShadow({mode: 'open'}).innerHTML = '<style>article{display:block}input{height:30px;width:200px}</style><input type="search"><article><h3><a href="/record/99">Research record rendered inside an open shadow component</a></h3></article>';}); snapshot = await read(); assert.equal(snapshot.papers.length, 1); assert.ok(snapshot.search); passed('Open shadow search/result components are supported');

  await load(`<div role="search"><input type="search" aria-label="Search library catalogue" value="same query"><button onclick="history.replaceState({},'', '?query=changed');document.querySelector('.results-count').textContent='1 result';setTimeout(()=>{document.querySelector('#results article').replaceWith(document.querySelector('#results article').cloneNode(true));window.resultsCommitted=true},1200)">Search</button></div><div class="results-count">2 results</div><div class="advertisement"><span>First ad</span></div><section id="results"><article><h2><a href="/record/same">Identical records after a real asynchronous response</a></h2></article></section>`);
  snapshot = await read(); const revision = snapshot.resultRevision, documentId = snapshot.documentId;
  assert.equal(snapshot.search.catalogue, true); assert.match(snapshot.search.label, /library catalogue/);
  await act({kind:'search', query:'same query', token:snapshot.search.token});
  await page.locator('.advertisement').evaluate(element => {element.innerHTML = '<article><h3>An unrelated advert was refreshed</h3></article>';});
  await page.waitForTimeout(760);
  let refreshed = await read(); assert.equal(refreshed.resultRevision, revision); assert.equal(refreshed.documentId, documentId); assert.match(refreshed.url, /query=changed/);
  await page.waitForFunction(() => window.resultsCommitted);
  refreshed = await read(); assert.ok(refreshed.resultRevision > revision); assert.deepEqual(refreshed.papers, snapshot.papers);
  passed('Same-query delayed identical card replacement commits only after response; URL, input, count and ads do not');
  const replacedRevision = refreshed.resultRevision;
  await page.locator('#results').evaluate(element => {element.replaceWith(element.cloneNode(true));});
  refreshed = await read(); assert.ok(refreshed.resultRevision > replacedRevision); passed('Replacing an entire results root retains the monotonic commit signal');
  const removedRevision = refreshed.resultRevision;
  await page.locator('#results').evaluate(element => {element.remove();}); refreshed = await read(); assert.ok(refreshed.resultRevision > removedRevision); passed('Removing result regions is observable without a global mutation false positive');
  console.log(JSON.stringify({passed: true, cases: count, profile}));
} finally {if (app) await app.close(); await new Promise(resolve => fixture.close(resolve));}
