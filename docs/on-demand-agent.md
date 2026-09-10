# 按需调用外部 Agent / On-demand agents

## 使用方式

1. 安装官方原生 Codex CLI 或 Claude Code，并在该工具中登录一次。普通网页聊天或任意 MCP 客户端不能替代 CLI。LitGraph 不代填登录凭据。
2. 在“模型接入 → 方式1”选择工具，点击“连结并验证”。自动查找失败时，用“选择程序”选择官方 `codex.exe` 或 `claude.exe`，不粘贴命令或脚本。
3. 验证会发送一个很短的真实模型请求，使用该工具账号的额度。成功后保存工具选择；软件重启后复用选择和 CLI 自身的登录状态，无需重新复制接入说明。
4. 直接在 LitGraph 检索、导入分析或提问。无需持续运行外部聊天任务。登录过期、额度不足、网络中断或 CLI 参数不兼容时，任务会报错，需要处理原因后重新发送。

程序不接管其他会话，不强制结束用户在 Codex / Claude Code 中已有的任务。账号计划、组织策略和并发限制仍由服务商控制。显示的 `Codex · CLI` / `Claude Code · CLI` 是工具标识，不是假定的底层模型版本。此路径暂不支持图片输入。

## 请求覆盖

| 应用请求 | 传入内容 | 输出 |
| --- | --- | --- |
| 文献发现 | 研究描述、筛选条件、检索策略契约 | 策略 JSON，由软件调用真实学术来源 |
| 文献分析 | MD 原文、分类、候选论文、证据要求 | 总结、分类、有原文证据的关系 JSON，由软件校验保存并重绘 |
| 研究空间 | 问题、对话、选中范围、原文片段、回答契约 | 回答及后续提问 JSON，AI 推断须标出 |

共同入口是 `callAI → externalCompletion → 本机任务队列 → CLI`。每个任务直接携带对应规范，不依赖 Agent 自行发现文档。原文和引用内容视为不可信数据，不执行其中的指令。沿用现有 JSON 校验，不把思考内容冒充最终回答。

## 运行边界

- Codex 使用官方 `codex exec`；Claude Code 使用官方 `claude -p`。每个任务独立启动，使用空白工作目录，通过标准输入传入材料，完成后退出，不恢复其他会话。
- 关闭环境说明、插件、钩子和执行工具。Codex 使用只读沙箱；Claude 使用 safe mode、空工具集和空 MCP 配置。不使用跳过审批或沙箱的参数。
- 快速偏好映射为 low effort，专家映射为 high effort，同时保留任务中的深度/速度要求。这不是固定时延承诺，CLI 须支持相应参数。
- 一个实例同时运行一个任务，最多接受八个运行/排队任务。取消排队任务不会启动进程；取消运行任务只终止本次创建的子进程树。单任务上限十分钟，验证上限九十秒，不自动重试模型调用。
- 输入与结果各限制 4 MB，只支持文本。材料过大、登录/额度/网络错误会报错，不偷偷切换到保存的 API。
- 保存工具选择及用户选择的程序路径，不复制 CLI 凭据。临时空白目录用完后删除，不记录原文、回答或原始诊断日志。CLI 和服务商本身的数据政策另行适用。
- CLI 未配置代理环境变量时，桌面版沿用操作系统为模型服务选择的代理，不读取或传递机构登录 Cookie。
- 断开或还原设置会清除启用状态，不注销 CLI 账号，不删除研究数据。软件关闭时取消未完成任务，重启后由用户重新发起，不自动重复调用。
- 手动 MCP 保留在高级折叠菜单，需要支持持续处理任务的客户端。标准 MCP 不能唤醒已暂停或结束的任意聊天。两种模式不同时领取同一任务。

## English

Install and sign in to the official native Codex CLI or Claude Code. In **Model connection → Method 1**, choose the tool and **Connect & verify**. If detection fails, select its executable. Verification uses a small real request and that tool's account quota. LitGraph stores the selection and reuses CLI authentication after restart; no permanently running chat or repeated instruction copying is needed.

Search planning, imported-paper analysis and research questions share a bounded queue. Each request carries its existing output contract and evidence. Search/download remain application-owned; the CLI does not obtain institution cookies or additional file access.

Each request launches an isolated noninteractive process with tools/customizations restricted, sends text via stdin and exits after completion. It never resumes unrelated conversations. One task runs at a time, with eight accepted tasks maximum. Cancellation stops only the application's process tree. Calls are not automatically retried. Login expiry, quota limits, incompatible versions and network errors remain possible and are reported without silently switching to a saved API. CLI labels identify the tool, not a verified model version. Images are not currently supported.

Quick/expert preferences map to low/high effort. Tasks have a ten-minute timeout and 4 MB input/output limits. Resetting LitGraph settings does not log out the CLI or delete research data. Manual MCP remains a separate compatibility path requiring an active task-processing client.

## 官方接口 / Official interfaces

- [Codex non-interactive mode](https://developers.openai.com/codex/noninteractive/)
- [Claude Code programmatic usage](https://code.claude.com/docs/en/headless)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)
