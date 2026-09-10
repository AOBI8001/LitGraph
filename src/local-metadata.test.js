import assert from 'node:assert/strict';
import { shouldRefreshLocalMetadata } from './local-metadata.js';

const saved = { importedLocally: true, metadataChecked: true, doi: '10.3758/s13415-020-00796-3' };
assert.equal(shouldRefreshLocalMetadata(saved), false);
assert.equal(shouldRefreshLocalMetadata({ ...saved, metadataWarning: 'No exact record found' }), true);
assert.equal(shouldRefreshLocalMetadata({ ...saved, doi: saved.doi + ')' }), true);
assert.equal(shouldRefreshLocalMetadata({ ...saved, metadataChecked: false }), true);
assert.equal(shouldRefreshLocalMetadata({ ...saved, importedLocally: false, metadataWarning: 'failed' }), false);
assert.equal(shouldRefreshLocalMetadata({ ...saved, doi: undefined }), false);
console.log('Local metadata: retry failed and malformed legacy records, preserve successful cache.');
