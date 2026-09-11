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
