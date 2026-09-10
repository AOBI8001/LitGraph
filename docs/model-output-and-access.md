# Model output and institution download contract

## API and external Agent parity

API, managed Codex/Claude execution and manual MCP receive the same task messages. `src/ai-output-contract.js` is the shared presentation source; `research-agent.js` and `paper-analysis.js` attach it before choosing a transport.

- Research: valid JSON with an `answer` Markdown string and exactly three plain-text `suggested_followups`. Use short paragraphs and selective headings/lists, never raw HTML or outer code fences. The renderer sanitizes and formats all providers identically.
- Answers use supplied original excerpts. Missing evidence is explicit; each inference is marked. No mandatory citation decoration unless requested. Never invent quotations or paper details.
- Paper analysis: valid JSON with a plain-text paragraph summary, claim label, keywords, theory and evidence-backed relationships. Summaries cover question/method, findings and limitations when supported. Unsupported edges are omitted without discarding a valid summary.
- Discovery: one AI keyword-planning call, then source retrieval/filtering/deduplication. No per-result AI critique or relevance-assessment call.
- Quick/expert is a speed/depth preference with identical grounding standards, not a promise of response time.

## Institution session and receipt lifecycle

The desktop app owns one persistent institution browser session with encrypted cookie persistence. Browser navigation and downloads reuse that session. OA and institution acquisition each have a 30-second active budget. Each paper also has a cumulative 120-second manual-authentication budget, excluded from the active budget. Expiry produces an item-local, non-retryable failure; the batch continues and history retains the reason and completed files. User cancellation still pauses the whole batch.

During manual authentication, owned debugging connections are released and automated navigation/clicks stop. Only explicit user Save can resume a stable, nonblank, challenge-free document. A load-completion observer reads solely to identify an explicit publisher denial; it does not solve challenges or alter the page. Initial or newly detected blocks skip the paper immediately. There is no automatic cooldown/retry loop. The design adapts ScanSci session reuse and bounded retrieval, without a second browser or CAPTCHA-solving service.

Each manual PDF download captures its originating window's project/paper identity. The native process validates and persists the PDF and receipt before notifying the application. The application saves the original, updates matching project history entries, and continues conversion/analysis when its queue is available. Explicitly paused jobs remain paused. The receipt is acknowledged only after persistence; redelivery does not invalidate work already performed for that receipt. Polling and focus recovery complement the completion event. Other projects' receipts remain retained until their project is active.

History storage may contain several projects, but the UI and history actions are scoped to the active project and refreshed on project switches.

## Model catalog and usage

Catalog entries preserve older saved model IDs and custom endpoints. Availability still depends on each user's provider account. New verified IDs include `gpt-6-astra`, `claude-fable-5-1`, `glm-5.3`, `glm-5.3-flash`, `kimi-k3` and `kimi-k2.7-code`. Kimi's fixed-temperature constraints are respected. Supported reasoning controls are sent only for documented model/protocol combinations.

Managed Codex execution does not pass an explicit model ID and intentionally ignores unrelated user CLI configuration. It uses the installed official CLI's runtime default and account availability, not the model selected in an unrelated desktop conversation. The UI's CLI label identifies the tool; it is not a verified backend-model name. ChatGPT-authenticated execution consumes the account's applicable Codex allowance; API-key authentication uses API billing. No model work is free merely because it is invoked through MCP or a local executable.

Official references:

- [OpenAI GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)
- [Codex usage and pricing](https://learn.chatgpt.com/docs/pricing)
- [Claude model IDs](https://platform.claude.com/docs/en/models/overview)
- [Zhipu OpenAI-compatible API](https://docs.bigmodel.cn/cn/guide/develop/openai/introduction)
- [Kimi models and parameter constraints](https://platform.kimi.com/docs/api/models-overview)

## 完整输入、机构页面与多窗口会话

- 开放获取先使用完整输入，并通过 OpenAlex / Crossref 核验完全匹配标题；模型关键词只能补充，不能替换标题。年份、语言和开放获取筛选仍有效。
- 桌面机构模式向最后保存的网页实际搜索表单提交完整输入。结果候选必须来自该页的真实文献链接；公开元数据接口只核验、补全这些候选。普通图书馆介绍页、不可操作的检索框或未支持的页面结构会明确报错，用户需打开实际数据库检索页并保存。登录不能保证平台订阅覆盖或自动化兼容。
- 所有内置弹出窗口使用同一持久化机构会话，并拥有清除登录、清理 Cookie、保存状态并退出控件。保留网站写入的 Cookie 和持久化浏览器存储；会话 Cookie 另以操作系统加密保存。最后主动保存所在页面的地址同样加密保存；应用自动下载跳转不会覆盖该地址。
- 再次点击机构登录打开最后保存的页面。首次未配置时网址为空。浏览器存储不能延长服务端登录期限，也不能阻止出版商重新要求认证；遇到认证时暂停，等待用户手动完成。

## 内置浏览器的持续会话和下载任务

下载程序直接操作 LitGraph 内置浏览器的同一认证会话，不启动 ScanSci 自己的浏览器，也不向模型导出 Cookie。用户点击保存后窗口隐藏，页面与临时会话继续保留；应用重启后恢复可持久化 Cookie 和浏览器存储，服务器端登录过期仍需重新登录。

出版社规则只负责寻找当前文章的 PDF 入口。普通程序负责执行页面导航、读取 PDF 响应、点击明确的 PDF 控件，以及文件校验；模型不操作密码、购买、验证码或订阅流程。主页面产生的 PDF / 登录弹窗属于同一下载任务，取得的文件只进入该任务一次。需要认证时显示实际被拦住的窗口，暂停队列；用户完成后点击保存继续。不要把 Cookie 存在或窗口关闭当作获取到全文的证据。
