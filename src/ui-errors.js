const knownMessages = {
  '单个文档请小于 40 MB。': 'Each document must be under 40 MB.',
  'PDF 没有足够的可提取文字，可能是扫描件。请先 OCR，再上传 PDF 或 MD。': 'This PDF has insufficient extractable text and may be scanned. Run OCR first, then upload the PDF or Markdown.',
  '研究材料支持 PDF、MD、TXT、CSV、JSON、TeX。请先将其他格式转换为 PDF 或 MD。': 'Research materials support PDF, MD, TXT, CSV, JSON and TeX. Convert other formats to PDF or Markdown first.',
  '文件没有可读取的文字。': 'The file contains no readable text.',
  '图片支持 PNG、JPEG、WebP。': 'Supported images: PNG, JPEG and WebP.',
  '单张图片请小于 5 MB。': 'Each image must be under 5 MB.',
  '模型引用了不存在的证据编号，请重试。': 'The model referenced an unknown evidence ID. Please retry.',
  '本地服务不可用，请使用 LitGraph 本地启动器打开。': 'Local service unavailable. Open LitGraph using its local launcher.',
  '本地服务请求失败': 'Local service request failed',
  '外部 Agent 已离线，请让它恢复任务循环后重试。': 'The external agent is offline. Restart its task loop and retry.',
  '外部 Agent 超过 15 分钟未返回，请检查它的任务状态。': 'The external agent has not responded for 15 minutes. Check its task status.',
  '未提供可下载的 PDF 地址，请手动添加原文。': 'No downloadable PDF URL was provided. Add the full text manually.',
  'PDF 超过 40 MB': 'PDF exceeds 40 MB', '项目已切换': 'The project has changed'
};
const codeMessages = {
  output_limit: 'The model reached its output limit before completing an answer. Reduce the paper scope or simplify the question and retry. This is not a protocol mismatch.',
  refusal: 'The model did not answer this question. Rephrase it and retry.',
  incomplete: 'The model request did not complete. Retry or check the provider status.',
  reasoning_only: 'The model returned reasoning but no final answer. Try “Retry in quick mode”. If that also fails, check whether your provider supports disabling reasoning or choose another model. Reasoning has not been substituted for an answer.',
  tool_calls: 'The model requested a tool that is not connected to this research chat. No final answer was received.',
  empty_answer: 'No final answer was returned. Check the selected API protocol or retry later.',
  invalid_json: 'The endpoint did not return valid JSON. Check the API or proxy URL; do not use an ordinary chat website URL.'
};
export function localizedError(error, language = 'zh') {
  const message = typeof error === 'string' ? error : error?.message || (language === 'en' ? 'Unknown error' : '未知错误');
  if (language !== 'en') return message;
  // Translate only our own messages/codes, never model answers or arbitrary provider text.
  return codeMessages[error?.code] || knownMessages[message] || message;
}
