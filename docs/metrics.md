# LitGraph 使用统计

_LitGraph 1.0 · 产品维护者操作说明_

---

## 📊 统计口径

| 指标 | 计算方式 |
| --- | --- |
| 累计安装 | 服务端已记录的不同安装摘要总数，覆盖全部历史 |
| 新增安装 | 随机安装标识第一次成功上报；实际含义是首次启动，不是安装向导完成次数 |
| 每日活跃安装 | 当天发生打开或核心操作的安装标识去重 |
| 实际使用安装 | 当天发生至少一次核心操作的安装标识去重 |
| 打开次数 | 软件进程启动并显示主窗口，每次计一次；重复激活已打开窗口不计 |
| 使用次数 | 发起一次检索、提问、文件批量导入、检索结果批量导入、载入样例或点击论文节点，每次计一次 |

使用次数表示用户发起操作，不保证操作最终成功。一次导入 50 篇算一次导入操作，不算 50 次。鼠标移动、悬停、后台状态轮询和模型请求重试不计。当前不统计持续使用时长，也不区分不同操作的具体次数。

日期按事件发生时间折算为北京时间，以每日 00:00 为边界。安装标识不是自然人身份：同一人两台电脑算两个安装；复制整个用户数据目录可能被视为一个安装；删除用户数据后重新使用会产生新标识。离线、关闭统计、网络拦截或修改过的客户端可能导致少计；公开上报接口也不能完全防止伪造请求。这些是产品使用趋势，不是审计级实名人数。

例如，同一个新安装在一天启动 3 次、发起 8 次核心操作：新增安装 +1、活跃安装 +1、实际使用安装 +1、打开次数 +3、使用次数 +8。网络重发相同事件不会再次累加。只打开而不操作时，该安装计入活跃安装，不计入实际使用安装。

## 🔐 发送与保存

客户端只发送四个字段：

| 字段 | 内容 |
| --- | --- |
| `installId` | 本机生成并持久保存的随机 UUID |
| `eventId` | 单次操作的随机 UUID；重试保持不变 |
| `type` | `launch` 或 `use` |
| `occurredAt` | 操作时间，UTC ISO 格式 |

不发送论文、标题、路径、作者、DOI、对话、API 密钥、机构网址、硬件序列号或操作名称。Cloudflare 接收 HTTPS 请求时仍会处理网络层 IP 等连接信息；本项目的 Worker 不读取或写入 IP，不启用 Worker 请求日志。因此应称为基于随机标识的最小化统计，而不是承诺完全匿名。

服务端以私有盐值计算安装标识的 HMAC，只保存摘要，不保存原始安装 UUID。事件表使用唯一事件编号防止重试重复计数；一次原子批处理同时写入安装记录和每日计数。事件去重记录约保留 8 天，按日清理；每日计数和安装记录保留用于历史统计。

客户端离线队列保留最多 1,000 条、最多 7 天；单次请求超时 10 秒，后台每分钟重试，每批最多 30 条。统计失败不阻止软件使用。设置 → 关于 LitGraph 可关闭基础统计，关闭时清空未发队列，不删除已收到的汇总记录。

开发预览、未打包开发运行和自动化测试默认不发送正式统计。

## 📍 查看数据

管理页面：[LitGraph 使用统计](https://litgraph.aobi.qzz.io/__metrics/)。

1. 打开管理页面。
2. 输入本机私有文件 `output/metrics-admin.local.json` 中的 `ADMIN_TOKEN`。
3. 查看累计安装及最近 31 天内有记录日期的统计；无记录日期当前不补零展示。再次点击“查看统计”刷新。

管理口令只在页面内存中使用，不放入网址或浏览器持久存储。不要把管理文件、口令或 `INSTALL_SALT` 上传 GitHub，也不要打包进安装程序。丢失管理口令可重新设置 Cloudflare Secret；不要随意更换 `INSTALL_SALT`，否则同一个安装会被计算成新的标识。

统计使用介绍网站的 `/__metrics/*` 独立 Worker 路由，不替换介绍主页或下载按钮。`GET /__metrics/health` 可检查服务响应；`GET /__metrics/stats` 必须携带管理口令，返回汇总信息，不返回安装标识列表。

## 🔧 自行部署与验证

公开模板为 `cloudflare/metrics/wrangler.jsonc`。复制成被 Git 忽略的 `wrangler.production.local.json`，使用自己的数据库 ID；如需绑定现有网站，添加只覆盖统计子路径的 Worker route。

```powershell
npx wrangler login
npx wrangler d1 create litgraph-metrics
# 把创建结果中的 ID 写入本机配置，再执行：
npx wrangler d1 execute litgraph-metrics --remote --file=cloudflare/metrics/schema.sql --config=cloudflare/metrics/wrangler.production.local.json
node scripts/configure-metrics-secrets.mjs
Get-Content -Raw output/metrics-admin.local.json | npx wrangler secret bulk --config=cloudflare/metrics/wrangler.production.local.json
npx wrangler deploy --config=cloudflare/metrics/wrangler.production.local.json
```

修改 `desktop/metrics.mjs` 中的接收地址后重新打包。不要修改安装标识的随机生成方式为硬件指纹。

`pnpm test` 覆盖事件重复、日活去重、权限、字段最小化、离线重试和重启持久化。维护者可运行 `node scripts/verify-metrics-remote.mjs` 验证真实服务；它写入一个合成安装，需随后执行该次生成的 `output/metrics-test-cleanup.sql`，只清除该合成标识的数据。正式用户数据不应作为测试素材。

## ⚠️ 免费额度与故障

当前 Workers Free 为每天 100,000 次请求；D1 Free 为每天 5,000,000 行读取、100,000 行写入、总存储 5 GB。这是账户额度，不是每个应用各有一份。一次事件涉及多个写入，不能把 100,000 行写入理解为 100,000 次使用。免费套餐并非无限，也不承诺政策永远不变。[^1][^2]

本项目没有自动升级付费套餐的逻辑。免费额度耗尽、域名不可达或数据库异常时，统计可能延迟或遗漏，软件继续工作。维护者需在 Cloudflare 控制台关注额度与数据库空间。

[^1]: Cloudflare. Workers platform limits. https://developers.cloudflare.com/workers/platform/limits/
[^2]: Cloudflare. D1 pricing. https://developers.cloudflare.com/d1/platform/pricing/
