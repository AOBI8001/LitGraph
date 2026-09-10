import {createPublicFetcher} from './public-fetch.js';
import {pdfLinksFromHtml, acquisitionError, mergeMetadata} from './scholarly-service.js';

const PDF_LIMIT = 40 * 1024 * 1024;
const pmcPage = address => /^https:\/\/(?:www\.)?(?:ncbi\.nlm\.nih\.gov\/pmc|pmc\.ncbi\.nlm\.nih\.gov)\//i.test(address);
function sourceUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    url.hash = '';
    return url.href;
  } catch { return ''; }
}
export function isCompletePdf(bytes) {
  return Buffer.isBuffer(bytes) && bytes.length <= PDF_LIMIT &&
    bytes.subarray(0, 1024).includes(Buffer.from('%PDF-')) && bytes.subarray(-2048).includes(Buffer.from('%%EOF'));
}

// Source-directed acquisition, not a general browser crawler. Each distinct
// source URL is visited once. DNS/TLS checks and redirect limits live in fetch.
export function acquisitionCore({scholarly, download = createPublicFetcher({timeoutMs:12000, connectTimeoutMs:4000, headerTimeoutMs:7000}), totalMs=30000, requestMs=12000, resolverMs=8000} = {}) {
  return async function acquire(paper, signal) {
    signal?.throwIfAborted();
    const started = Date.now(), stop = new AbortController();
    const deadline = AbortSignal.any([stop.signal, AbortSignal.timeout(totalMs), ...(signal ? [signal] : [])]);
    const attempts = [], seen = new Set(), resolvedRepositories = new Set();
    let metadata = {...paper}, found, pages = 0;
    const outcome = result => ({...result, metadata, attempts:[...attempts], elapsedMs:Date.now() - started});
    const directUrls = p => p.isOpenAccess ? [...new Set([p.pdfUrl, ...(p.pdfUrls || [])].map(sourceUrl).filter(Boolean))] : [];
    const originalCandidates=new Set(directUrls(metadata));
    const newCandidates=()=>[...new Set([metadata.fulltextRepository?sourceUrl(metadata.pdfUrl):'',...directUrls(metadata).filter(address=>!originalCandidates.has(address))])].filter(address=>address&&!seen.has(address));
    async function visit(address, origin='verified_source') {
      address = sourceUrl(address);
      if (!address || seen.has(address) || seen.size >= 6 || found || pmcPage(address)) return;
      seen.add(address);
      const start = Date.now();
      try {
        const response = await download(address, {signal:AbortSignal.any([deadline, AbortSignal.timeout(requestMs)]), limit:PDF_LIMIT});
        deadline.throwIfAborted();
        if (isCompletePdf(response.bytes)) {
          attempts.push({url:address, code:'saved', elapsedMs:Date.now()-start});
          const repositoryAddress=sourceUrl(metadata.pdfUrl);
          const source=origin===metadata.fulltextRepository && address!==repositoryAddress ? 'Verified open-access source' : origin;
          found = {success:true, bytes:response.bytes, url:response.url || address, source};
          return;
        }
        if (response.bytes.subarray(0,1024).includes(Buffer.from('%PDF-'))) throw Error('The source returned an incomplete PDF.');
        const links = pages++ < 2 ? pdfLinksFromHtml(response.bytes.subarray(0,2*1024*1024).toString('utf8'), response.url || address) : [];
        attempts.push({url:address, code:links.length ? 'landing_page' : 'not_pdf', elapsedMs:Date.now()-start,
          message:links.length ? 'Following the article page’s advertised PDF link.' : 'The source returned a page instead of a PDF. Authentication or a manual download may be required.'});
        if (links.length) await visit(links[0], origin);
      } catch (error) {
        signal?.throwIfAborted();
        if (!found && !stop.signal.aborted) attempts.push({...acquisitionError(error,address), elapsedMs:Date.now()-start});
      }
    }
    async function firstAvailable(addresses, origin) {
      const queue = [...new Set(addresses)].filter(a => !seen.has(a) && !pmcPage(a));
      // Race at most two verified copies. Return on success without waiting for
      // a hung alternative; abort its socket before leaving acquire().
      const pending = new Set();
      const launch = () => {
        while (queue.length && pending.size < 2 && seen.size < 6 && !found && !deadline.aborted) {
          let job;
          job = visit(queue.shift(), origin).finally(() => pending.delete(job));
          // Every losing request is observed even when the winner returns.
          job.catch(()=>{});
          pending.add(job);
        }
      };
      launch();
      while (pending.size) { await Promise.race(pending); if(found) return; launch(); }
    }
    async function resolve(operation, label) {
      if (deadline.aborted || !operation) return;
      try { metadata = await operation(metadata, AbortSignal.any([deadline, AbortSignal.timeout(resolverMs)])) || metadata; }
      catch (error) { signal?.throwIfAborted(); attempts.push({...acquisitionError(error), source:label}); }
    }
    async function resolveRepository() {
      const identity=metadata.pmcid || [metadata.sourceUrl,...(metadata.oaLandingUrls||[]),...(metadata.pdfUrls||[])].join(' ').match(/\bPMC\d+\b/)?.[0] || metadata.doi || 'unidentified';
      if(resolvedRepositories.has(identity))return;
      resolvedRepositories.add(identity);
      await resolve(scholarly?.resolveOpenAccess,'PMC repository');
    }
    try {
      // Search already supplied full metadata and verified PDF links. Do not
      // run DOI rediscovery before trying those links.
      // Reserve the remaining URL/time budget for an independent repository.
      // A long publisher candidate list must not starve the PMC fallback.
      await firstAvailable(directUrls(metadata).slice(0,2), 'Verified open-access source');
      if (found) return outcome(found);
      await resolveRepository();
      // Only newly resolved copies here. Existing low-priority publisher links
      // must not consume the slots reserved for DOI enrichment or article pages.
      await firstAvailable(newCandidates().slice(0,1), metadata.fulltextRepository || 'Verified open-access source');
      if (found) return outcome(found);
      if (!deadline.aborted && scholarly?.enrich) {
        const previous = metadata;
        await resolve(scholarly.enrich, 'Metadata alternatives');
        metadata = mergeMetadata(previous, metadata);
        await resolveRepository();
        await firstAvailable(newCandidates().slice(0,1), metadata.fulltextRepository || 'Verified open-access source');
      }
      if (found) return outcome(found);
      // An article page needs room for its advertised PDF as well. Try one
      // useful landing page before the remainder of a long direct-link list.
      if (metadata.isOpenAccess && !deadline.aborted && seen.size<=4) await firstAvailable((metadata.oaLandingUrls || []).map(sourceUrl).filter(address=>address&&!seen.has(address)&&!pmcPage(address)).slice(0,1), 'Verified open-access article page');
      if (found) return outcome(found);
      await firstAvailable(directUrls(metadata), 'Verified open-access source');
      if (found) return outcome(found);
      const failures = attempts.filter(a=>a.message && a.code!=='landing_page');
      const error = failures.length ? [...new Set(failures.map(a=>a.message))].join('; ') : metadata.isOpenAccess
        ? 'The verified open-access record did not provide an accessible PDF. Supply the original or use an authenticated institution session.'
        : 'No verified open-access original is available. Use your institution or supply an original you are permitted to access.';
      return outcome({success:false, status:metadata.isOpenAccess?'unavailable':'needs_access', error, retryable:false});
    } finally { stop.abort(); }
  };
}
