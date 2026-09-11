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
