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
