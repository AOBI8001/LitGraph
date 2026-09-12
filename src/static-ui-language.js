// Capture only the application's initial chrome. Never translate paper text,
// project names, API responses, or user-authored conversations.
const english = {
  '先登录官方 Codex 或 Claude Code，再测试并保存。连接后，检索、论文分析和研究问答会按需调用。': 'Sign in to official Codex or Claude Code, then test and save. Searches, paper analysis and research questions run on demand.',
  '支持 OpenAI、Claude、Deepseek、Qwen等。密钥仅保存在当前设备。': 'Supports OpenAI, Claude, Deepseek, Qwen and more. Keys stay on this device.',
  '推荐': 'Recommended',
  '登录官方 Codex或 Claude Code。点击连结并验证。连接成功后，检索、论文分析和研究问答会按需调用。': 'Sign in to official Codex or Claude Code, then select Connect & verify. Once connected, searches, paper analysis and research questions run on demand.',
  '连接外部 Agent 或模型 API，开始检索与研究。': 'Connect an external agent or model API to start searching and researching.',
  '支持 OpenAI、Claude、智谱、Kimi、Qwen、DeepSeek 与豆包。密钥仅保存在当前设备。': 'Supports OpenAI, Claude, Zhipu, Kimi, Qwen, DeepSeek and Doubao. Keys stay on this device.',
  '外部 Agent 工具': 'External agent tool',
  '连结并验证': 'Connect & verify',
  '选择程序': 'Choose executable',
  '其他工具：手动 MCP 接入': 'Other tools: manual MCP connection',
  '仅用于能持续处理 MCP 任务的工具；普通 MCP 连接无法自动唤醒聊天会话。': 'For tools that can continuously handle MCP tasks. A standard MCP connection cannot wake a chat session automatically.',
  '论文导入历史': 'Paper import history',
  '删除选中文献': 'Delete selected papers',
  '保存原文，转换为 MD 并分析，自动更新论文图谱。': 'Save originals, convert to Markdown and analyze, then update the paper graph.',
  '发送基础使用统计': 'Send basic usage statistics',
  '仅发送随机安装标识、事件编号、打开或使用事件及时间；不发送论文、对话或密钥。可随时关闭。': 'Sends only a random installation ID, event ID, launch or use event, and timestamp. No papers, conversations, or API keys. You can turn this off at any time.',
  '从示例开始探索': 'Explore a sample graph',
  '按研究主题查找论文': 'Search by research topic',
  '导入本地论文': 'Import local papers',
  '方式2：外部 Agent': 'Method 2: External agent',
  '例如 Codex · Claude Code 等': 'For example, Codex · Claude Code',
  '方式1：API': 'Method 1: API',
  '删除该配置': 'Delete configuration',
  '连接外部 Agent 或 API': 'Connect an external agent or API',
  '复制接入说明，发送给你的 Agent，并保持任务运行。': 'Send these instructions to your agent and keep its task running.',
  '完成连接后，LitGraph 会自动弹窗确认。': 'LitGraph will confirm a successful connection in a dialog.',
  'LitGraph 桌面窗口': 'LitGraph desktop window', '窗口控制': 'Window controls',
  '最小化窗口': 'Minimize window', '最大化窗口': 'Maximize window', '关闭窗口': 'Close window',
  '最小化': 'Minimize', '最大化': 'Maximize', '关闭': 'Close',
  '跳到图谱画布': 'Skip to graph canvas', '图谱视图': 'Graph views', '图谱控制': 'Graph controls',
  '项目统计': 'Project statistics', '研究主题加载中': 'Loading research topic',
  '搜索论文、作者或 DOI': 'Search papers, authors, or DOI',
  '调整侧栏宽度': 'Resize sidebar', '调整详情栏宽度': 'Resize details panel',
  '调整左侧栏宽度': 'Resize sidebar', '详细设置': 'Detailed settings',
  '论文关系力导向图': 'Paper relationship graph', '论文关系三维图': '3D paper relationship graph',
  '图谱图例': 'Graph legend', '画布工具': 'Canvas tools', '正在构建三维图谱…': 'Building 3D graph…',
  '设置': 'Settings', '添加论文': 'Add papers', '文献发现': 'Literature discovery', '研究空间': 'Research space',
  '拖入论文原文': 'Drop paper files here', '支持 PDF、Markdown、TXT、LaTeX、CSV 与 JSON': 'Supports PDF, Markdown, TXT, LaTeX, CSV and JSON',
  '这是一个空白 LitGraph 项目': 'This is an empty LitGraph project',
  '选择一种方式开始构建你的论文图谱。': 'Choose a way to start building your literature graph.',
  '样例数据': 'Sample data', '选择论文文件': 'Choose paper files', '论文标签': 'Paper label', '保存标签': 'Save label',
  '滚轮缩放、拖动背景平移、拖动论文并固定、单击查看详情；编辑模式下单击论文可修改标签': 'Scroll to zoom, drag the background to pan, drag papers to pin them, and click for details. In rename mode, click a paper to edit its label.',
  '模型接入': 'Model connection',
  '支持 OpenAI、Claude、Kimi、Qwen、DeepSeek 与豆包。密钥仅保存在当前设备。': 'Supports OpenAI, Claude, Kimi, Qwen, DeepSeek and Doubao. Keys are stored only on this device.',
  'API 地址 (Base URL)': 'API endpoint (Base URL)', '显示 API Key': 'Show API key', '显示': 'Show',
  '模型': 'Model', '自定义': 'Custom', '自定义模型 ID': 'Custom model ID', '输入模型 ID…': 'Enter model ID…',
  '当前模型支持图片输入（请根据服务商说明确认）': 'This model supports image input (check your provider’s documentation)',
  '外部 Agent 访问': 'External agent access',
  '复制后发给你的 AI，让它按说明连接并保持任务运行。': 'Copy and send to your AI. Ask it to connect and keep the worker running.',
  '复制文本': 'Copy instructions', '断开外部 Agent': 'Disconnect external agent',
  '取消': 'Cancel', '测试并保存': 'Test & save', '关于 LitGraph': 'About LitGraph', '开源许可：MIT': 'Open-source license: MIT',
  'LitGraph 是面向文献综述、理论比较与研究空白发现的本地论文可视化工作台。它把论文、观点、理论类别与关系放进一张可以直接操作的图谱。': 'LitGraph is a local literature workspace for literature reviews, theory comparison, and research gap discovery. Explore papers, claims, theory categories, and relationships in an interactive graph.',
  '从文献发现、原文导入到二维与三维图谱，LitGraph 帮助你梳理研究脉络、比较观点与方法，并围绕单篇或多篇论文开展原文问答。论文原文、转换后的文本与分析结果保存在本机，可接入自己的模型 API 或外部 Agent。': 'From literature discovery and original-file import to 2D and 3D graphs, LitGraph helps you trace research, compare findings and methods, and ask evidence-grounded questions across one or many papers. Originals, converted text and analysis are stored on your device. Connect your own model API or an external Agent.',
  '项目开源、免费，允许学习、修改与再发布。如果它对你有帮助，欢迎前往 GitHub 点一个 Star。': 'Free and open source, for learning, modification, and redistribution. If it helps you, consider starring the project on GitHub.',
  '打开 GitHub 地址': 'Open GitHub',
  '一次可以导入一篇或多篇论文，处理完成后再统一加入画布。': 'Import one or more papers, then add them to the canvas when processing is complete.',
  '拖放或选择论文文件': 'Drop or choose paper files', '将论文文件拖到这里': 'Drop paper files here',
  '支持 PDF、Word、TXT、Markdown、RTF、HTML、EPUB、ODT、LaTeX、CSV 与 JSON': 'Supports PDF, Word, TXT, Markdown, RTF, HTML, EPUB, ODT, LaTeX, CSV and JSON',
  '选择文件': 'Choose files', '完成': 'Done'
};

export function captureStaticUI(root) {
  const entries = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest('[data-i18n], script, style')) continue;
    const zh = node.nodeValue.trim();
    if (english[zh]) entries.push({node, zh, en: english[zh]});
  }
  root.querySelectorAll('*').forEach(node => {
    for (const attr of ['aria-label', 'title', 'placeholder']) {
      const zh = node.getAttribute(attr);
      if (english[zh]) entries.push({node, attr, zh, en: english[zh]});
    }
  });
  return language => entries.forEach(({node, attr, zh, en}) => {
    if (!node.isConnected) return;
    const value = attr ? node.getAttribute(attr) : node.nodeValue.trim();
    if (value !== zh && value !== en) return; // a dynamic renderer now owns this field
    if (attr) node.setAttribute(attr, language === 'en' ? en : zh);
    else node.nodeValue = language === 'en' ? en : zh;
  });
}
