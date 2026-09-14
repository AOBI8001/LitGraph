# LitGraph 1.3.0

2026-09-14 · Windows x64 / macOS 13+（仅 Apple Silicon M 系列）

## Download for Windows

[**Download for Windows — Windows 10 / 11 x64**](https://github.com/AOBI8001/LitGraph/releases/download/v1.3.0/LitGraph-Setup-1.3.0-x64.exe)

## Download for macOS

[**Download for macOS — Apple Silicon (M 系列)**](https://github.com/AOBI8001/LitGraph/releases/download/v1.3.0/LitGraph-1.3.0-macOS-arm64.dmg)

- **快速回答更充分**：常规概念问题的引导篇幅由约 120–220 字调整为约 350–600 字，展开结论、关键证据与必要限制；多篇比较优先覆盖不同论文和方法维度，可以更长。简单事实问题仍可简短回答，不通过增加检索或额外润色请求凑字数。
- **专家回答不再被追问格式拖累**：正文与追问独立校验，支持完整正文缺少追问、可恢复的 JSON 展示错误、代码围栏和直接 Markdown 回答。无效追问单独舍弃，不补造问题，不再因为未凑齐三个追问而丢弃正文。API 与外部 Agent 使用同一最终呈现校验。
- **保留流式结果与真实错误**：网络断流、输出达到上限、服务拒答仍按失败处理；已收到的正文保留并明确标注尚未完成，不作为后续对话的已完成证据。引用仍按本次检索核验，不放宽未知引用、原句、页码和行号的规则。
- 新增格式恢复、截断/拒答、跨协议流结束检查及五篇比较桌面回归。真实 API 对同一组五篇论文做了专家与快速模式检查；单次结果不代表性能中位数或新的准确率 benchmark。

升级保留本机项目和配置。安装包仅包含内置样例与默认资源，不含开发者个人项目、问答历史或密钥。Windows 安装包未签名；macOS 13+ 包采用 ad-hoc 签名，**未做 Apple Developer ID 签名或公证**。请核对 SHA256SUMS.txt，参考 [Mac 安装说明](https://github.com/AOBI8001/LitGraph/blob/v1.3.0/docs/MACOS.md)，保留系统安全防护。

## English

- More substantial Quick answers: normally 350–600 Chinese characters or 220–380 English words, with flexible length for simple facts and multi-paper comparisons. No extra model call solely to lengthen or reformat an answer.
- Validate the answer separately from optional follow-ups. Preserve complete answers with missing/malformed suggestions, recoverable JSON presentation errors, fences or final Markdown. Keep citation validation unchanged for API and external Agent responses.
- Recognize stream completion and genuine failures across protocols. Preserve received partial text with an explicit unfinished label after a failure; never treat it as completed conversation evidence.
- Add five-paper desktop and unit regressions. Live API checks are individual runs, not a new latency median or accuracy benchmark. Windows and Apple Silicon macOS only; macOS is ad-hoc signed, not notarized.

---

# LitGraph 1.2.9

2026-09-14 · Windows x64 / macOS 13+（仅 Apple Silicon M 系列）

## Download for Windows

[**Download for Windows — Windows 10 / 11 x64**](https://github.com/AOBI8001/LitGraph/releases/download/v1.2.9/LitGraph-Setup-1.2.9-x64.exe)

## Download for macOS

[**Download for macOS — Apple Silicon (M 系列)**](https://github.com/AOBI8001/LitGraph/releases/download/v1.2.9/LitGraph-1.2.9-macOS-arm64.dmg)

- **回答聚焦研究结论**：取消每次回答自动追加的覆盖统计，调整提示词，不再反复说明“送回几篇片段”“其余论文未送回”“旧编号本轮无法核实”。对孤立的此类过程段落做保守精简；不改写带引用的研究结论和原文。
- **保留必要的诚实边界**：原文证据、页码行号、引用未核验标记、具体证据不足和真实处理失败仍会提示，不把检索未命中说成没有相关研究。用户主动询问检索覆盖时仍可获得说明。旧历史不会被删除，也不额外调用模型润色。
- **新增 macOS**：仅提供 Apple Silicon（M 系列）原生 DMG，不发布 Intel Mac 版；适配打开原文、外部 CLI 选择及 Finder 启动时的路径。两平台均带内置 50 篇样例与离线模型，不含开发者个人项目、问答、密钥或设置。

Windows 安装包未签名。macOS 包采用 ad-hoc 临时签名，尚无 Apple Developer ID 签名或公证；最低 macOS 13。请核对同一 Release 中 SHA256SUMS.txt。Mac 安装请参考 [安装说明](https://github.com/AOBI8001/LitGraph/blob/v1.2.9/docs/MACOS.md)，保留系统安全防护。

## English

- Remove repetitive excerpt-count and previous-ID bookkeeping from ordinary research answers. Preserve original quotations, verifiable citations, substantive uncertainty and genuine failures; explicit diagnostic questions are exempt. No additional rewriting model call.
- Add a native Apple Silicon M-series macOS DMG alongside Windows; no Intel Mac installer. Isolated desktop tests exercise sample retrieval and answer presentation with a mock model; this is not a new live-model benchmark.
- macOS 13+; ad-hoc signed, **not Apple-notarized**. Both platforms contain only bundled sample resources and defaults, not developer profiles. Verify SHA256SUMS.txt before installing.

---

# LitGraph 1.2.8

2026-09-13 · Windows 10 / 11 x64 · `LitGraph-Setup-1.2.8-x64.exe`

- **两类研究问答**：普通事实问题继续使用混合相关检索；集合概括、逐篇比较与文献筛选使用范围覆盖。路由使用本地规则，不为分类单独调用模型，支持明确指定的论文范围。
- **带出处的论文卡片**：保存研究问题、对象、方法与发现的原文摘录。导入分析复用同一次模型请求提供引句并做字面匹配；旧论文读取时自动建立本地候选摘录卡片，不填造缺失内容，也不重新计费分析。卡片按原文指纹失效更新。
- **逐篇检索与分批汇总**：比较/筛选在每篇内部检索；大范围概括和比较分批判断、必要时分层汇总，不再在 120 篇截断。记录逐篇结果与不确定性，显示范围处理进度；同一问题暂停后重试复用已完成批次，应用重启后需重新请求。
- **更诚实的证据说明**：展示实际来源覆盖与分析数量；检索未命中不能视为不存在。模型判断基于摘录，不承诺逐字阅读全文或穷尽找齐所有匹配项。修复原文可用性与向量索引状态混淆，保留原文预览、页码行号和跨轮证据隔离。
- 新增卡片、路由、29 篇分批、150 篇分层、失败/取消/重试及真实样例与桌面回归检查。包含此前本地 1.2.7 的概览修复。具体限制与验证方式见 [覆盖说明](docs/RESEARCH_COVERAGE_1.2.8.md)。

本版未重新测量真实模型召回率、准确率或 API 耗时；历史 1.2.6 指标不代表本版新增流程。大范围核查会增加模型调用次数与费用，可先选中较小范围试用。临时附件不纳入集合逐篇核查，回答会明确提示。安装包不含开发者个人项目、密钥和问答历史；升级保留本机数据。安装包未签名，请核对 `SHA256SUMS.txt`，保留系统安全防护。

## English

- Separate relevance retrieval from scoped coverage with local task routing. Preserve ordinary fact-query retrieval; use per-paper source cards for overviews and per-paper retrieval for comparison/screening.
- Reuse the import analysis call for source-matched card quotations. Upgrade old sources with locally selected, versioned source excerpts without extra model calls. Missing information remains unknown.
- Add bounded batches, hierarchical synthesis, globally scoped evidence IDs, review ledgers, progress and in-request retry reuse. No 120-paper cutoff in the application collection workflow; coverage is not exhaustive full-text reading or proof of absence.
- Include the local 1.2.7 overview fix and new regression checks. No new live-model accuracy or API-latency claims. Large scopes cost more calls; temporary attachments are explicitly excluded from library scope reviews.

---

# LitGraph 1.2.7

2026-09-13 · 本地修复版，尚未发布 GitHub

- **全库概览覆盖**：识别“这些文献主要研究什么”等概括问题，逐篇选取摘要、研究目的或正文开头的原文证据，不再沿用普通事实问题的全库 Top-K。50 篇样例均有 MD，此次修复不填造或改写原文。
- **准确说明证据范围**：区分原文可用、只有摘要、无来源文本和上下文预算遗漏；概览带上全部已覆盖论文的元数据，不再只保留快速模式前 12 篇。全文可用不等于本次已阅读全文，也不等于向量索引已完成。
- 概览摘录总预算为 42,000 字符，最多覆盖 120 篇；更大项目明确提示未覆盖数量，不能声称完成全库穷尽综述。普通事实问答仍使用原有混合检索，不扩大每道问题的延迟。
- 增加真实 50 篇样例覆盖、通用导入文献、结构化摘要空标题、缺失来源、大库预算及桌面问答回归测试。

## English

- Add source-based, per-paper collection overviews instead of applying global fact-query top-K to library synthesis. Preserve exact excerpt offsets and quotations.
- Distinguish source availability from retrieval coverage and vector-index readiness. Include metadata for every covered overview paper; report actual missing sources and budget omissions.
- Bound overview evidence to 42,000 characters and 120 papers, without claiming exhaustive full-text review. Retain the normal fact-query retrieval path.

# LitGraph 1.2.6

2026-09-13 · Windows 10 / 11 x64 · `LitGraph-Setup-1.2.6-x64.exe`

## 中文

- **按问题分配检索投入**：简单概念问题保持本地词汇扩展；样本量、精确事实、明确论文及比较问题恢复精简的多查询规划。规划只携带明确提及的论文元数据和有限用户追问，不发送整库标题与旧回答；有效规划可复用，最多等待 16 秒，失败仍使用较大的事实题证据预算。
- **减少比较题与细节遗漏**：快速事实题采用 20 段 / 28,000 字符基础预算，专家为 24 段 / 42,000 字符。明确指定的比较对象均分基础证据名额，并增加一轮本地补检，查找问题维度及匹配的摘要、正文开头；最多补 6 段 / 8,400 字符，总字符上限 48,000。补检不额外请求模型，不现场重建段落向量。
- **保留响应与可追溯性**：继续使用后台增量索引、已就绪向量检索、限时关键词降级和流式回答。证据编号在最终证据包确定后统一分配；原文摘录、页码行号、项目隔离及未知引用提示保持不变。
- 补充取消、规划超时、来源范围、双论文证据覆盖和桌面问答回归测试，并更新检索架构说明。

固定回归集实测：参考证据召回 87/89（97.75%），严格答案准确率 69/69（100%），完整回答后端中位数 20.60 秒（1.2.5 为 12.11 秒）。这是已知样例回归集、当前 Codex CLI 的结果，尚无独立人工复核，不代表任意问题或其他模型的保证；方法与局限见 [1.2.6 评测报告](https://github.com/AOBI8001/LitGraph/blob/v1.2.6/docs/RAG_BENCHMARK_1.2.6.md)。

更大的证据范围和额外规划会增加复杂问题的耗时。补检是检索启发式，不是事实核验或穷尽检索；准确率取决于语料、原文质量、模型和问题。升级保留本机数据与配置；安装包只携带内置样例，不含开发者个人项目、密钥和问答历史。安装包未签名，请核对 `SHA256SUMS.txt`，并保留系统安全防护。

## English

- Route simple concepts through local expansion and precise facts/comparisons through compact, cached multi-query planning. Send only explicitly mentioned paper metadata and bounded user follow-ups. Planning has a 16-second deadline; fallback retains the larger fact-query evidence budget.
- Use base budgets of 20 chunks / 28,000 characters for quick facts and 24 / 42,000 for expert requests. Balance explicitly named comparison targets, then perform one local query-aspect and abstract/lead-paragraph coverage pass: at most 6 extra chunks / 8,400 characters, capped at 48,000 total. No extra model call or on-demand passage indexing in this pass.
- Retain background incremental indexes, ready-vector lookup, bounded lexical fallback, streamed answers, source quotations/locations, project isolation and visible unverified-citation warnings. Assign evidence IDs only after assembling the final context.
- Add cancellation, planning-deadline, scope, comparison-coverage and desktop regressions; update architecture documentation.

Known-suite measurement: 87/89 reference recall (97.75%), 69/69 strict necessary-fact accuracy (100%), 20.60-second median backend completion (1.2.5: 12.11 seconds). This is the current Codex CLI on a known sample regression set, without independent human review—not a guarantee for unseen questions or other models. See the [evaluation report](https://github.com/AOBI8001/LitGraph/blob/v1.2.6/docs/RAG_BENCHMARK_1.2.6.md).

Complex questions intentionally trade additional latency for evidence coverage. Coverage heuristics are neither factual verification nor exhaustive retrieval. Upgrades retain local data/settings; installers exclude developer projects, credentials and conversations. The installer is unsigned; verify `SHA256SUMS.txt` and keep system protections enabled.

---

# LitGraph 1.2.5

2026-09-12 · Windows 10 / 11 x64 · `LitGraph-Setup-1.2.5-x64.exe`

## 中文

- **原文证据摘录**：来源条目展示原文开头最多 24 个词，长片段使用 `...` 省略；不会因第一句过短而只展示几个词。原文本身不足十词时完整展示，不编造补足；中文按词分段。
- **跨轮证据编号**：历史回答不再携带上一轮来源编号与来源附录，明确限定模型只能引用本次检索的编号。支持组合编号、区间与全角括号。不存在的编号标注“引用未核验”，保留可用回答和真实来源，不再让整条问答报 Unknown evidence ID，也不会将错误编号强行匹配到其他论文。
- **样例检索修复**：按当前分段规则重建样例向量缓存，覆盖 50 个节点、3,225 个片段；启动后自动准备样例索引。共享原文的不同节点使用独立索引标识，避免覆盖。重复读取不再无条件重写原文并重新排队。
- **降级说明**：区分后台准备、检索超时与真正不可用。冷索引没有可用向量时直接返回关键词路径，不额外加载查询模型；专家改写失败仍保留本地中英关键词扩展。
- 增加打包时样例缓存覆盖检查，以及两轮桌面问答、异常引用和实际本地向量检索回归测试。保留 1.2.4 的左键旋转、右键平移操作。

有效证据编号表示对应原文存在，不等于模型结论已获人工核验。标注未核验的引用及其相关结论仍需检查。首次索引与模型加载需要时间，不承诺固定回答时长。升级保留本机数据与配置，建议先备份。安装包未代码签名，请核对 `SHA256SUMS.txt` 并保留系统安全防护。

## English

- Show up to 24 original opening words in source entries, with `...` for longer excerpts. Continue beyond a short first sentence; show originals shorter than ten words fully without inventing text.
- Remove prior-turn source IDs and appended source lists from model history. Explicitly scope allowed IDs to the current request; support grouped, ranged and full-width citations. Unknown IDs are visibly marked unverified rather than failing the whole answer or being remapped to unrelated sources.
- Rebuild sample vectors for the current 3,225 chunks across 50 nodes and prepare indexes automatically on launch. Give nodes sharing an original distinct index identities; avoid rewriting unchanged sample documents on every question.
- Distinguish warming, time-budget fallback and actual unavailability. Skip query-model loading for empty indexes; retain local bilingual expansion when expert query rewriting fails.
- Add packaging coverage checks and two-turn desktop tests with real local vector retrieval and deliberately invalid model references. Retain left-drag rotation and right-drag panning.

Resolvable citations do not guarantee factual correctness. Unverified citations and associated claims require source checking. Initial indexing/model loading still takes time. Upgrade retains local data/settings; back up first. The installer is unsigned; verify `SHA256SUMS.txt` and keep system protections enabled.

---

# LitGraph 1.2.4

2026-09-12 · Windows 10 / 11 x64 · `LitGraph-Setup-1.2.4-x64.exe`

## 中文

本节汇总从上一公开版本 **1.2.1 → 1.2.4** 的主要变化，包含此前仅本地测试的问答性能优化。

- **研究问答性能**：合并同页同章节的过短片段；MD 保存后自动增量建立本地向量索引，启动时补建旧项目并恢复进度。快速模式不再为整库现场编码，不单独调用模型改写；向量检索超时或未就绪时退回关键词检索。支持 API 流式回答及可输出增量内容的外部 Agent。
- **研究上下文与证据**：按项目隔离对话、标签页和草稿；切换项目时取消旧请求。来源条目保留文献、页码和行号，并展示原句开头十个词，余文以 `...` 省略；中文按词分段。引用可定位不等于结论必然正确，仍需核对原文。
- **原文元数据补全**：直接读取可解析原文中的署名与出版/学位日期；已有本地项目打开时自动检查旧记录，分析阶段增加有原文引句核验的模型提取。无法确认时保持未知，不再把当前年份当出版年；被引量只取可核验的学术记录，不从正文猜测。
- **画布交互与计数**：全部 3D 视图保留左键拖动空白处旋转，无需组合键；右键拖动平移，画面跟随鼠标。项目菜单按未隐藏的画布节点计数，而非全部导入记录。
- **界面与数据管理**：移除研究空间的全文索引操作区，维护在后台进行；API 标记推荐，API 与外部 Agent 统一“测试并保存”样式及位置。设置顺序为数据文件夹、还原设置、清除数据；清除用户数据需确认，内置样例始终保留。
- 其他改进：优化长文本布局、错误提示和请求取消；补充中英文说明、元数据/手势测试、桌面隔离与大批次回归。

升级保留已有项目、原文与配置，请先备份重要数据。大批索引仍需后台计算时间；模型输出速度取决于模型、网络与额度，不承诺固定回答时长。扫描件、异常编码和含混元数据可能仍需人工校正。安装包未代码签名，请核对同一 Release 的 `SHA256SUMS.txt`；校验和不代替签名，不建议关闭系统安全防护。

## English

Major changes since the previous public release **1.2.1**, including locally tested performance work:

- Merge short fragments; automatically checkpoint background passage vectors on MD save and backfill/resume on launch. Quick mode avoids a separate model rewrite and query-time corpus encoding, with bounded dense retrieval and lexical fallback. Stream API answers and compatible external-Agent output.
- Isolate conversations, tabs and drafts by project; cancel stale requests on switching. Evidence sources include the first ten original words plus `...` when truncated, alongside page/line locations. Chinese uses word segmentation. Locatable citations still require substantive verification.
- Recover bylines and publication/thesis dates from readable originals, check existing local records on opening, and verify model-extracted bibliographic fields against supplied source quotes during analysis. Unknown dates stay unknown; citation counts require verified scholarly records.
- Pan all 3D views with right-drag; retain background left-drag rotation without modifier keys. Project counts exclude hidden import nodes.
- Remove indexing controls from Research space; mark API Recommended and align both Test & save actions. Settings order: data folder, reset settings, clear data. Confirmed user-data clearing always retains the bundled sample.
- Smaller layout, error-feedback, cancellation and regression-test improvements.

Upgrades retain projects, originals and settings; back up important data first. Background indexing still needs compute time, and model latency is not guaranteed. Scans, damaged encodings and ambiguous metadata may need manual corrections. The installer is unsigned: verify `SHA256SUMS.txt` and retain system protections. Checksums do not replace code signing.

---

# LitGraph 1.2.1

## 中文

安装文件：`LitGraph-Setup-1.2.1-x64.exe`（Windows 10 / 11 x64）。升级保留项目与原文；重要数据请先备份。

- 修复大项目达到浏览器缓存配额后，项目状态无法可靠保存的问题。桌面端以磁盘状态为准，按阶段落盘，并串行保存同一项目的快照。
- 暂停、重启或更换 API / 外部 Agent 后，可继续未完成阶段。现成 MD 优先进入分析，不再被待转换或失败 PDF 阻塞。
- 历史记录新增“重新绘制画布”：重算布局，隐藏该次导入尚未分析的节点；文件、分析与记录保留，点击“继续”恢复节点显示。
- 历史折叠时仍显示三项阶段进度，展开后才生成逐篇明细，减少大批次的界面刷新开销。
- 补齐 PDF.js 本地字符映射、字体与解码资源，修复部分中文 PDF 因资源缺失而提取不到文字的问题。真正扫描件、损坏文件和异常编码仍可能需要 OCR 或可读替代文件。

不承诺每份 PDF 均可转换，也不保证模型响应时长。安装包未代码签名，请核对同一 Release 的 `SHA256SUMS.txt`，并保留系统安全防护。本地用户数据和此次恢复用的 OCR 工作文件不包含在安装包中。

## English

Installer: `LitGraph-Setup-1.2.1-x64.exe` for Windows 10 / 11 x64. Upgrades retain projects and source files; back up important data first.

- Desktop workspace persistence now tolerates browser-cache quota limits, checkpoints completed stages and serializes writes for each project.
- Resume after pause, restart or an API / external Agent change. Existing Markdown is analyzed before retrying pending PDF conversions.
- New **Redraw canvas** history action recalculates layout and hides unanalyzed nodes from that import without deleting source files, analyses or history. Continue restores their visibility.
- Folded history keeps all three progress bars visible and generates individual details only when expanded.
- Bundle local PDF.js character maps, fonts and decoder resources to fix missing-resource extraction failures in some Chinese PDFs. Scans, damaged files and broken encodings may still require OCR or readable replacements.

Not every PDF is convertible, and model latency is not guaranteed. The installer is unsigned; verify the release's `SHA256SUMS.txt` and keep system protections enabled. Private user data and one-off OCR recovery files are not shipped.

---

# LitGraph 1.2.0

[中文使用说明](README.md) · [English guide](README.en.md)

## 中文

下载 **`LitGraph-Setup-1.2.0-x64.exe`**，适用于 Windows 10 / 11 x64，无需另装 Node.js 或 Python。运行安装程序即可安装或升级；升级保留已有研究数据，建议提前备份重要项目与原文。

### 本版更新

- 模型接入调整为方式 1：API，方式 2：外部 Agent；初次配置默认显示 DeepSeek V4.1 Flash，保留已有配置。
- 研究空间支持段落与章节感知分块、多查询及两层关键词、关键词与本地多语言向量混合检索，以及原文位置溯源。优化快速问答的检索、缓存和模型调用开销。
- 文献发现支持开放获取、开放获取与机构联合、机构访问三种来源；机构通道为 Beta，遇到验证交给用户处理，超时或封锁可跳过。
- 保留 2D / 3D 理论及语义图谱、年份树、筛选、数据表和项目内研究对话。
- 设置提供产品网站入口，关于页面提供 GitHub 链接；窗口最大化与还原图标跟随实际窗口状态。
- 更新中英文使用说明，加入 8 张功能展示图；扩展使用统计的周活、月活、首日激活和回访指标，沿用原有最小化事件字段。

### 安装与边界

安装包未代码签名，Windows 可能提示未知发布者或 SmartScreen 警告。请从本仓库下载并比对 `SHA256SUMS.txt`；校验和不代替签名，请保留系统安全防护。

远程模型需要用户自己的账号、API 权限或额度。回答耗时受模型和网络影响，不承诺固定响应时间。机构登录不代表所有论文均可获取，下载与验证仍受出版商政策限制。论文原文与模型输出应由用户核对；软件的 MIT 许可不改变第三方论文或模型的许可。

## English

Download **`LitGraph-Setup-1.2.0-x64.exe`** for Windows 10 / 11 x64. No separate Node.js or Python installation is required. Run the installer to install or upgrade. Existing research data is preserved; back up important projects and originals first.

### Highlights

- API is now connection Method 1; external Agent is Method 2. Initial setup displays DeepSeek V4.1 Flash without replacing saved configurations.
- Research Space combines paragraph/section-aware chunking, multi-query and two-level keyword planning, keyword and local multilingual vector retrieval, and source-location attribution. Faster quick-question paths reuse caches and reduce model-call overhead.
- Literature discovery offers open access, combined open/institutional sources, and institutional access. Institutional channels are Beta; human verification, timeouts and publisher blocking remain acquisition boundaries.
- Interactive 2D / 3D theory and semantic graphs, year trees, filtering, data tables and scoped research conversations.
- Product-website and GitHub links open in the system browser; maximize/restore icons follow the actual window state.
- Bilingual guides include eight product screenshots. Usage analytics add weekly/monthly activity, first-day activation and returning usage, using the existing minimized event fields.

### Installation and limitations

The installer is unsigned. Windows may show unknown-publisher or SmartScreen warnings. Download from this repository and verify `SHA256SUMS.txt`. A checksum is not a code signature; keep system protections enabled.

Remote AI requires your own account, API access or quota. Response time depends on the model and network. Institutional sign-in does not guarantee access to every paper. Publisher access rules still apply. Verify source texts and model outputs; LitGraph's MIT license does not relicense third-party papers or models.
