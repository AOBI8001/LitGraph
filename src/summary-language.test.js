import assert from 'node:assert/strict';
import {summaryForLanguage,summaryTranslationMessages} from './summary-language.js';
assert.equal(summaryForLanguage({aiSummaryZh:'中文',aiSummaryEn:'English'},'en'),'English');
assert.equal(summaryForLanguage({aiSummaryZh:'中文',summary:'中文'},'en'),'');
assert.equal(summaryForLanguage({summary:'English legacy'},'en'),'English legacy');
assert.equal(summaryForLanguage({aiSummaryZh:'中文',aiSummaryEn:'English'},'zh'),'中文');
assert.match(summaryTranslationMessages('数据','en')[0].content,/Preserve all qualifications/);
console.log('Bilingual summary selection and translation contract passed');
