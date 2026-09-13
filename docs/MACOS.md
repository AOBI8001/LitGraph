# macOS 安装与构建

需要 macOS 13 Ventura 或更新系统（[Electron 44 最低要求](https://releases.electronjs.org/release/v44.0.0)）。在“关于本机”查看芯片：Apple M 系列选 arm64，Intel 选 x64。打开对应 DMG，将 LitGraph 拖到 Applications，再从“应用程序”打开。

## 安全与数据

当前包为 ad-hoc 临时签名，未经 Apple Developer ID 签名和公证，不是 Mac App Store 安装包。核对 GitHub 官方 Release 与 SHA256SUMS.txt 后，只有确认信任此应用时才按照 [Apple 官方说明](https://support.apple.com/en-au/102445) 单独允许打开。不要关闭 Gatekeeper、SIP 或系统整体安全防护。临时签名不代表 Apple 验证开发者身份或应用安全。

Windows 与 macOS 包均从源码构建，只带内置 50 篇样例、模型和默认配置，不带开发者私人论文库、API 密钥、问答或个人设置。首次从空项目开始；样例通过入口载入。macOS 数据按 Electron 默认位置保存在当前账户的 Application Support/litgraph 中，API 配置通过系统安全存储加密。两个系统不会自动同步数据。

## 构建与验证

GitHub Actions 手动运行 `.github/workflows/macos.yml`，分别在 Apple Silicon 和 Intel macOS 15 runner 上构建相同提交，运行单元测试、安装包内容审计和隔离配置的桌面问答测试。无需开发者的本地配置或用户资料。测试使用本机模拟模型接口，验证真实 UI、原文检索与来源展示，不代表真实模型准确率测量。

源码仓库不包含大体积样例全文和模型。`scripts/restore-release-resources.mjs` 只从已发布的 1.2.8 Windows 包中恢复相同的公共资源，并验证固定 SHA-256；不会复用旧版可执行代码，也不会读取开发者本地数据。依赖、前端和 Electron 由当前源码及锁文件重新构建。

在 macOS 上：`pnpm install --frozen-lockfile`，显式运行 `node node_modules/electron/install.js`，准备上述资源后执行 `pnpm dist:mac`。构建依赖使用 pnpm 10；项目运行需要 Node.js 22.12+，CI 使用 Node.js 24。当前流水线仅产生测试通过的构建附件，发布前再统一核对提交、Windows/Mac 校验和与测试结果。

后续拥有 Apple Developer ID 证书及公证凭据时，可按 [electron-builder v26 文档](https://www.electron.build/v26/docs/features/code-signing/code-signing-mac/) 配置正式签名、公证。当前不假称已公证。
