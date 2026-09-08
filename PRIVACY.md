# LitGraph privacy / 隐私说明

_Version 1.0 · Applies to the official desktop build_

---

## 🔐 中文

论文、原文索引、项目和对话默认保存在当前 Windows 用户的本地数据目录。LitGraph 不提供论文云同步。桌面版的 API 配置使用操作系统提供的加密功能保存；开发者网页预览的 API 配置仍使用浏览器本地存储，不具备相同的保护。

使用远程 AI API 时，问题、相关论文原文片段、必要元数据和用户添加的附件会发送到用户配置的模型服务。外部 Agent 接入时，这些任务数据交给用户指定的 Agent。请自行确认这些服务的隐私政策及论文的使用权限；本地存储不等于所有 AI 处理都离线。

文献发现向学术数据源发送检索词与筛选条件，合法下载可获取的全文。机构网址只是用户指定的访问入口；软件不会提取机构 Cookie 或自动获得订阅权限。

官方桌面版本默认向 `https://litgraph.aobi.qzz.io/__metrics/event` 发送基础使用统计：随机安装标识、随机事件编号、打开/使用事件及时间。不发送论文、对话、模型密钥、文件路径、硬件标识或具体操作名称。统计服务由 Cloudflare Workers 和 D1 承载；Worker 保存安装标识的 HMAC 摘要，不记录 IP。Cloudflare 仍会处理网络连接信息。

可在“设置 → 关于 LitGraph”关闭基础统计。关闭后停止新事件并清空未发送队列；已上报统计不会自动删除。事件去重记录约保留 8 天，每日汇总和安装摘要保留用于产品统计。更多口径及限制见 [统计说明](docs/metrics.md)。

普通卸载默认保留用户数据，避免意外丢失论文。清理或迁移前请关闭软件并备份本地数据；项目 JSON 不包含所有原文，也不包含 API 密钥。

## 🔐 English

Papers, full-text indexes, projects, and conversations are stored under the current Windows user's local application-data directory. LitGraph does not provide cloud library synchronization. The desktop app encrypts saved API configuration using the operating system; the developer web preview still uses browser local storage and does not provide the same protection.

Remote AI requests send your question, relevant original-text excerpts, necessary metadata, and attached materials to the provider you configure. External-agent tasks are sent to the agent you connect. Review those providers' privacy policies and your rights to use the materials. Local storage does not mean remote AI processing is offline.

Literature discovery sends search terms and filters to scholarly sources and downloads lawfully accessible originals. An institutional URL is an entry point, not a shared login session. LitGraph does not extract institutional cookies or acquire subscription access automatically.

Official desktop builds send basic usage events to `https://litgraph.aobi.qzz.io/__metrics/event` by default: a random installation ID, random event ID, launch/use type, and timestamp. Events contain no papers, conversations, model keys, file paths, hardware identifiers, or specific action names. Cloudflare Workers and D1 host the collector. The Worker stores an HMAC of the installation ID and does not log IP addresses; Cloudflare necessarily processes connection information.

Disable reporting in Settings → About LitGraph. Disabling stops new events and clears the unsent queue, but does not automatically erase previously received statistics. Deduplication records are retained for approximately eight days; daily aggregates and installation hashes are retained for product statistics. These counts describe installations, not verified individual people.

Uninstallation preserves user data by default. Close the application and back up its data directory before migration or removal. A project JSON export is not a complete backup of originals and does not include API keys.
