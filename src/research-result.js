// Final research presentation only. Import/planning schemas remain strict.
// Missing optional suggestions must never erase an otherwise usable answer.
const parse = text => { try { return JSON.parse(text); } catch { return null; } };
const unwrap = text => text.replace(/^```(?:json|markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, '$1').trim();

function enclosedResult(text) {
  // Parse whole outer objects, ignoring braces inside quoted source text.
  // Never fish an answer out of a nested reasoning/tool object.
  let start = -1, depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (start < 0) { if (c === '{') { start = i; depth = 1; } continue; }
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
    if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      const object = parse(text.slice(start, i + 1));
      if (typeof object?.answer === 'string') return object;
      start = -1;
    }
  }
  return null;
}

function completeAnswerField(text) {
  // Recover only a complete first answer field, not an unfinished streaming
  // prefix or an arbitrary nested `answer` inside model reasoning/tool data.
  const start = /^\{\s*"answer"\s*:\s*"/.exec(text);
  if (!start) return null;
  let encoded = '"';
  for (let i = start[0].length; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') {
      if (i + 1 >= text.length) return null;
      encoded += c + text[++i];
    } else if (c === '"') {
      // A quote in malformed prose is not proof that the answer ended.
      if (!/^\s*(?:$|}\s*$|,\s*"suggested_followups"\s*:)/.test(text.slice(i + 1))) return null;
      return parse(encoded + '"');
    } else {
      // Literal line breaks in a JSON string are a presentation error only.
      encoded += c.charCodeAt(0) < 32 ? JSON.stringify(c).slice(1, -1) : c;
    }
  }
  return null;
}

export function normalizeResearchResult(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw Error('模型未返回回答正文。 / No answer was returned.');
  const text = unwrap(raw.replace(/^\uFEFF/, '').trim());
  let parsed = parse(text);
  if (typeof parsed === 'string') parsed = parse(parsed);
  if (!parsed && !/<\/?(?:think|thinking|analysis|reasoning)\b/i.test(text)) parsed = enclosedResult(text);
  let answer = typeof parsed?.answer === 'string' ? parsed.answer.trim() : '';
  let recovered = false;
  if (!answer && !parsed) {
    const field = completeAnswerField(text);
    if (typeof field === 'string') { answer = field.trim(); recovered = true; }
    // Only accept final prose, never JSON envelopes, HTML or reasoning traces.
    else if (!/^[\[{"`<]|<\/?(?:think|thinking|analysis|reasoning)\b|"(?:answer|suggested_followups|reasoning_content)"\s*:/i.test(text)) {
      answer = text; recovered = true;
    }
  }
  if (!answer) throw Error('模型没有返回可完整读取的回答正文，请重试。 / No complete readable answer was returned.');
  const followups = Array.isArray(parsed?.suggested_followups)
    ? [...new Set(parsed.suggested_followups.filter(q => typeof q === 'string').map(q => q.trim())
      .filter(q => q && q.length <= 160 && !/[\r\n<>]|\[E\d+\]|```/i.test(q)))].slice(0, 3) : [];
  return { answer, suggested_followups: followups, recovered };
}
