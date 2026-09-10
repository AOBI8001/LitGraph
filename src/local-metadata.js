import { cleanDoi } from './discovery-contract.js';

export function shouldRefreshLocalMetadata(node) {
  if (!node?.importedLocally) return false;
  // A failed lookup is not a successful cache entry. Older saved jobs may also
  // contain a DOI with trailing punctuation from a PDF sentence.
  return !node.metadataChecked || Boolean(node.metadataWarning)
    || cleanDoi(node.doi) !== String(node.doi || '').trim();
}
