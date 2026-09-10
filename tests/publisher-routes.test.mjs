import test from 'node:test';
import assert from 'node:assert/strict';
import {detectPublisher,publisherPdfCandidates,isArticlePdfCandidate} from '../desktop/publisher-routes.mjs';

test('publisher matching uses domain boundaries and exact DOI prefixes',()=>{
  assert.equal(detectPublisher('https://www.sciencedirect.com/science/article/pii/S001'),'elsevier');
  assert.equal(detectPublisher('https://sciencedirect.com.attacker.example/'), '');
  assert.equal(detectPublisher('https://unknown.example/','10.10160/other'),'');
  assert.equal(detectPublisher('https://unknown.example/','10.1016/j.test.12'),'elsevier');
});

test('ScienceDirect ranks metadata before same-article anchors and deterministic route',()=>{
  const url='https://www.sciencedirect.com/science/article/pii/S0005791610000170';
  const html='<meta name="citation_doi" content="10.1016/j.test.1"><meta name="citation_pdf_url" content="https://pdf.sciencedirectassets.com/1-s2.0-S0005791610000170/main.pdf?token=valid&amp;download=1"><a href="/science/article/pii/S0005791610000170/pdfft">Download PDF</a><a href="/science/article/pii/S0005791610000999/pdfft">Download PDF</a>';
  assert.deepEqual(publisherPdfCandidates({url,doi:'10.1016/j.test.1',html}),[
    'https://pdf.sciencedirectassets.com/1-s2.0-S0005791610000170/main.pdf?token=valid&download=1',url+'/pdfft',
  ]);
  assert.equal(isArticlePdfCandidate('https://pdf.sciencedirectassets.com/1-s2.0-S0005791610000999-main.pdf',{sourceUrl:url}),false);
});

test('supplementary assets and preview documents are never a main paper',()=>{
  const sourceUrl='https://www.sciencedirect.com/science/article/pii/S123456';
  for(const candidate of ['/1-s2.0-S123456-mmc1.pdf','/content/image/paper.pdf','/article-preview.pdf','/supporting-information.pdf','/paper_s1.pdf','/main.pdf?preview=true','/main.pdf?file=supplementary.pdf'])
    assert.equal(isArticlePdfCandidate(candidate,{sourceUrl}),false,candidate);
  assert.deepEqual(publisherPdfCandidates({url:'https://unknown.example/article/42',html:'<meta name="citation_pdf_url" content="/paper-preview.pdf">'}),[]);
});

test('DOI identity compares the entire DOI, including encoded slash',()=>{
  const sourceUrl='https://onlinelibrary.wiley.com/doi/10.1002/test.42';
  assert.equal(isArticlePdfCandidate('/doi/pdfdirect/10.1002%2Ftest.42',{sourceUrl,doi:'10.1002/test.42'}),true);
  assert.equal(isArticlePdfCandidate('/doi/pdf/10.1002/test.420',{sourceUrl,doi:'10.1002/test.42'}),false);
  assert.equal(isArticlePdfCandidate('/doi/pdf/10.1002/other.42',{sourceUrl}),false);
  assert.deepEqual(publisherPdfCandidates({url:sourceUrl,doi:'10.1002/test.42',html:'<meta name="citation_doi" content="10.1002/other.42"><meta name="citation_pdf_url" content="/download.pdf">'}),[]);
});

test('Springer, Nature, Wiley, ACS, SAGE and T&F use observed origin and article',()=>{
  const cases=[
    ['https://link.springer.com/article/10.1007/s123-456','https://link.springer.com/content/pdf/10.1007/s123-456.pdf'],
    ['https://www.nature.com/articles/s41586-020-2649-2','https://www.nature.com/articles/s41586-020-2649-2.pdf'],
    ['https://onlinelibrary.wiley.com/doi/full/10.1002/test.42','https://onlinelibrary.wiley.com/doi/pdfdirect/10.1002/test.42'],
    ['https://pubs.acs.org/doi/10.1021/test.42','https://pubs.acs.org/doi/pdf/10.1021/test.42'],
    ['https://journals.sagepub.com/doi/abs/10.1177/12345','https://journals.sagepub.com/doi/pdf/10.1177/12345'],
    ['https://www.tandfonline.com/doi/full/10.1080/12345','https://www.tandfonline.com/doi/pdf/10.1080/12345'],
  ];
  for(const [url,expected] of cases)assert.equal(publisherPdfCandidates({url})[0],expected,url);
  assert.equal(isArticlePdfCandidate('https://www.nature.com/articles/s41586-020-2649-3.pdf',{sourceUrl:cases[1][0]}),false);
});

test('IEEE never follows a different article number',()=>{
  const url='https://ieeexplore.ieee.org/document/123456';
  assert.deepEqual(publisherPdfCandidates({url}),['https://ieeexplore.ieee.org/stampPDF/getPDF.jsp?arnumber=123456','https://ieeexplore.ieee.org/stamp/stamp.jsp?arnumber=123456']);
  assert.equal(isArticlePdfCandidate('https://ieeexplore.ieee.org/stampPDF/getPDF.jsp?arnumber=123457',{sourceUrl:url}),false);
});

test('PDF viewer wrappers cannot hide another DOI or supplementary document',()=>{
  const url='https://pubs.acs.org/doi/10.1021/test.42';
  assert.equal(isArticlePdfCandidate('/viewer?file=%2Fdoi%2Fpdf%2F10.1021%2Fother.42',{sourceUrl:url}),false);
  assert.equal(isArticlePdfCandidate('/viewer?file=%2Fsupplementary.pdf',{sourceUrl:url}),false);
  assert.equal(isArticlePdfCandidate('/viewer?file=%2Fdoi%2Fpdf%2F10.1021%2Ftest.42',{sourceUrl:url}),true);
  const generic='https://publisher.example/article/42';
  assert.deepEqual(publisherPdfCandidates({url:generic,html:"<script>PDFViewerApplicationOptions.set('defaultUrl', '/42.pdf')</script>"}),['https://publisher.example/42.pdf']);
});

test('institution gateway path and origin survive route derivation',()=>{
  const url='https://vpn.university.example/https/encoded/doi/full/10.1002/test.42';
  const candidates=publisherPdfCandidates({url,doi:'10.1002/test.42'});
  assert.ok(candidates.length);assert.ok(candidates.every(v=>v.startsWith('https://vpn.university.example/https/encoded/doi/')));
  assert.equal(publisherPdfCandidates({url:'https://vpn.university.example/login',doi:'10.1002/test.42'}).length,0);
  const html='<meta name="citation_pdf_url" content="/https/encoded/doi/pdf/10.1002/test.42">';
  assert.equal(publisherPdfCandidates({url,doi:'10.1002/test.42',html})[0],'https://vpn.university.example/https/encoded/doi/pdf/10.1002/test.42');
});

test('unknown publishers use one explicit PDF control, never arbitrary bibliography PDFs',()=>{
  const url='https://publisher.example/article/42';
  assert.deepEqual(publisherPdfCandidates({url,html:'<a href="/a.pdf">Related paper</a>'}),[]);
  assert.deepEqual(publisherPdfCandidates({url,html:'<a href="/a.pdf">Download PDF</a><a href="/b.pdf">View PDF</a>'}),[]);
  assert.deepEqual(publisherPdfCandidates({url,html:'<a href="/a.pdf">Download <b>PDF</b></a>'}),['https://publisher.example/a.pdf']);
  assert.deepEqual(publisherPdfCandidates({url,html:'<a href="javascript:alert(1)">Download PDF</a>'}),[]);
  assert.deepEqual(publisherPdfCandidates({url,html:'<meta name="citation_pdf_url" content="http://127.0.0.1/a.pdf">',normalize:()=>{throw Error('private address');}}),[]);
});
