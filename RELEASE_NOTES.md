# LitGraph 1.0

[中文使用说明](README.md) · [English guide](README.en.md)

## 📦 中文

Windows x64 安装包：`LitGraph-Setup-1.0.0-x64.exe`。支持 Windows 10 / 11；无需另装 Node.js 或 Python。首次打开为空白项目，可选择模型接入或载入 50 篇样例论文。

- 文献发现：5–100 篇检索数量、真实学术来源、语言与类型筛选、确认导入、合法开放 PDF 下载和 Markdown 原文索引。
- 研究空间：按论文范围问答、快速 / 专家偏好、回车发送、取消 / 重新提交、原文片段检索和具体追问。
- 可视化：观点图、年份树、2D / 3D、理论及语义布局，保留样例理论颜色。
- 桌面能力：原生窗口控制、独立本地数据、加密 API 配置、内置 MCP 适配器运行环境。
- 基础统计：首次使用、每日活跃安装、打开与核心操作次数；可在“关于 LitGraph”关闭。

本版本未签名，可能出现 Windows 未知发布者 / SmartScreen 提示。只从本仓库下载并核验 `SHA256SUMS.txt`；校验和不代替签名，不建议关闭系统防护。

验证覆盖自动化测试、桌面启动和重启、MCP 握手与任务协议、三种模型协议的模拟响应、真实开放论文检索下载、PDF / MD 持久化、研究空间发送取消及 3D 交互。模型调用使用测试响应，不表示已实测每一家付费服务或每种模型。安装过程另在 Windows 本机测试；这不是所有设备、网络和文献都无缺陷的保证。

已知边界：无内置 OCR、无自动更新、不共享机构 Cookie、不保证每条记录能取得全文。使用远程模型需要自己的访问权限及额度。普通卸载保留用户数据；项目 JSON 不等于完整原文备份。

## 📦 English

Download `LitGraph-Setup-1.0.0-x64.exe` for Windows 10 / 11 x64. No separate Node.js or Python is required. Start with a blank project, connect AI or load the optional 50-paper sample.

Features include real-source scholarly discovery (5–100 records), reviewed imports, lawful open-PDF acquisition and local Markdown indexing; scoped evidence-grounded research with Quick / Expert preferences, Enter-to-send, cancellation and follow-ups; 2D / 3D viewpoint graphs and year trees; encrypted desktop model configuration and a bundled MCP adapter runtime. Basic installation and usage statistics can be disabled under About LitGraph.

This version is unsigned. Windows may show unknown-publisher or SmartScreen warnings. Download only from this repository and compare `SHA256SUMS.txt`; hashes do not replace signing, and disabling system protection is not recommended.

Validation includes automated tests, desktop startup/restart, MCP handshake and task protocol, simulated responses for three model protocols, a real open-access paper search/download, durable PDF / Markdown recovery, research submission/cancellation and 3D interactions. Model fixtures do not certify every live paid provider. The installer is separately tested on Windows, not guaranteed defect-free on all systems.

Known limitations: no built-in OCR, automatic updater or institution-cookie sharing; full text is not guaranteed. Remote AI needs your own access and quota. Normal uninstall preserves user data; project JSON is not a complete original-file backup.
