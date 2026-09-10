import assert from 'node:assert/strict';
import { localizedError } from './ui-errors.js';
assert.match(localizedError(new Error('文件没有可读取的文字。'),'en'), /readable text/);
assert.match(localizedError({code:'reasoning_only',message:'思考'},'en'), /no final answer/);
assert.equal(localizedError(new Error('文件没有可读取的文字。'),'zh'),'文件没有可读取的文字。');
assert.equal(localizedError(new Error('Provider-specific detail'),'en'),'Provider-specific detail');
assert.equal(localizedError('原文内容：文件没有可读取的文字。','en'),'原文内容：文件没有可读取的文字。');
console.log('UI error localization passed');
assert.match(localizedError("Error invoking remote method 'desktop:institution': Error: Institution HTTP 403",'zh'),/订阅权限/);
for(const text of ['The source returned an incomplete PDF.', 'The verified open-access record did not provide an accessible PDF. Supply the original or use an authenticated institution session.', 'Institution authentication is available in the desktop application, not this browser preview. Open-access acquisition was attempted; supply the original or use the installed application.'])assert.match(localizedError(text,'zh'),/[\u3400-\u9fff]/);
for(const text of ['原文尚未保存到磁盘，请检查可用空间。','原文已保存；请连接模型后继续分析。','尚无可分析的 MD 原文。','请先为这篇论文补充原文文件。','本地原文文件不可用，请补充原文。','MD 未保存到磁盘，请检查可用空间后继续。','论文节点已删除。'])assert.doesNotMatch(localizedError(text,'en'),/[\u3400-\u9fff]/);
for(const text of [
  'Institution search requires the desktop application’s authenticated browser session. Open the installed application to search this source.',
  'The institution browser did not return readable search records. Open the institution window and check the current results page.',
  'Institution source records are retained; unavailable supplementary metadata and citation counts remain unknown.',
  'Supplementary metadata for a different paper was ignored; the institution source record and its access route were preserved.',
  'Some source records lack a year, language or article type needed to verify the selected filters. Open the source record or broaden the filters.',
  'Some institution results were outside the selected year, language or article-type filters.',
  'Matching institution records already exist in the current project and were excluded from new results.',
  'The institution page contained unreadable result records. Open the institution window to check the current page.',
  'Institution pagination stopped before all pages were read; records already found are retained.'
]){assert.match(localizedError(text,'zh'),/[\u3400-\u9fff]/);assert.equal(localizedError(text,'en'),text);}
