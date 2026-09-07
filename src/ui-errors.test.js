import assert from 'node:assert/strict';
import { localizedError } from './ui-errors.js';
assert.match(localizedError(new Error('文件没有可读取的文字。'),'en'), /readable text/);
assert.match(localizedError({code:'reasoning_only',message:'思考'},'en'), /no final answer/);
assert.equal(localizedError(new Error('文件没有可读取的文字。'),'zh'),'文件没有可读取的文字。');
assert.equal(localizedError(new Error('Provider-specific detail'),'en'),'Provider-specific detail');
assert.equal(localizedError('原文内容：文件没有可读取的文字。','en'),'原文内容：文件没有可读取的文字。');
console.log('UI error localization passed');
