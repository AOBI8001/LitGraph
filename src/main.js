import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  hsl,
  interpolateRgb
} from 'd3';
import sampleProjectSource from 'virtual:litgraph-sample';
import { refreshSampleNodes } from './sample-corpus.js';
import { version as APP_VERSION } from '../package.json';
import { initialWorkspace } from './startup-project.js';
import { preferenceKeys } from './settings-reset.js';
import './styles.css';
import { mountResearchWindow } from './floating-research-window.js';
import { COUNT_OPTIONS, discoveryCount, planningMessages, normalizePlan, titleKey, cleanDoi, usesInstitution } from './discovery-contract.js';
import { capture2dFraming, match2dFraming } from './camera-framing.js';
import { closerCamera, navigationKeys, translateCamera } from './camera-navigation.js';
import { framePerspectiveModel, initialFramingPoints } from './perspective-framing.js';
import { readAIResponse, researchTokenBudget } from './ai-response.js';
import {createTextStream,partialAnswer} from './ai-stream.js';
import {normalizeResearchResult} from './research-result.js';
import { normalizeResearchMode, researchModePolicy, researchThinkingOptions, compatibleModelBody } from './research-mode.js';
import { researchMessages } from './research-agent.js';
import {prepareCollectionRequest} from './research-collection-flow.js';
import {buildPaperCard} from './research-card.js';
import { ResearchRequest, formatResearchDuration } from './research-request.js';
import {researchChatKey} from './research-scope.js';
import { externalState, refreshExternal, externalInstructions, externalCompletion, localRequest, copyTextToClipboard } from './external-agent.js';
import { extractFile, saveFulltext, saveOriginalFile, prepareEvidence, imageAttachment, withImages, originalBlob, getFulltext } from './fulltext.js';
import { HISTORY_KEY, restoreJobs, createImportJob, jobCounts, moveTab, processImportItem, processImportBatch, setImportCanvasVisibility } from './import-jobs.js';
import { paperAnalysisMessages, validatePaperAnalysis } from './paper-analysis.js';
import { shouldRefreshLocalMetadata, extractSourceMetadata, applySourceMetadata, verifiedModelMetadata, metadataFrontmatter, SOURCE_METADATA_VERSION } from './local-metadata.js';
import { messageMarkdown } from './message-markdown.js';
import { selectEvidence } from './research-evidence.js';
import { groundedEvidenceAnswer } from './research-evidence.js';
import {compactResearchAnswer,asksRetrievalDiagnostics} from './research-answer-style.js';
import { retrievalNotice } from './research-hybrid.js';
import { adaptiveQueryPlan, needsModelQueryPlan, retrievalPolicy } from './research-query.js';
import { linkMatchesSelection } from './graph-focus.js';
import { CANVAS_BACKGROUNDS, backgroundPreset, backgroundArtwork } from './canvas-backgrounds.js';
import { captureStaticUI } from './static-ui-language.js';
import { localizedError } from './ui-errors.js';
import { mountModelRotation } from './model-rotation.js';
import { summaryForLanguage, summaryTranslationMessages } from './summary-language.js';
import { desktop, desktopBootstrap, modelFetch, recordUse, workspaceSnapshot, flushDesktopState } from './desktop-bridge.js';

const RELATION_LABELS = { support: '支持', oppose: '反对', related: '相关' };
const EDGE_PALETTES = {
  e0: { support: '#14985b', oppose: '#e23d4b', relatedStrong: '#397db8', relatedWeak: '#909090' },
  e1: { support: '#0f8a78', oppose: '#e35d43', relatedStrong: '#356b91', relatedWeak: '#909090' },
  e2: { support: '#4c9b55', oppose: '#c83f67', relatedStrong: '#526fbd', relatedWeak: '#909090' },
  e3: { support: '#168f9a', oppose: '#d64d76', relatedStrong: '#6957b5', relatedWeak: '#909090' },
  e4: { support: '#538d69', oppose: '#d46952', relatedStrong: '#547b9b', relatedWeak: '#909090' },
  e5: { support: '#36a248', oppose: '#e33932', relatedStrong: '#337fbd', relatedWeak: '#909090' }
};
const PALETTES = {
  p0: ['#256aa3', '#7952a5', '#d76a16', '#258c42', '#c82f3a', '#a1a10b', '#82472f', '#d45f9e'],
  p1: ['#274753', '#297270', '#299d8f', '#8ab07c', '#e7c66b', '#f3a361', '#e66d50'],
  p2: ['#a30543', '#f36f43', '#fbda83', '#e9f4a3', '#80cba4', '#4965b0'],
  p3: ['#16058b', '#6200aa', '#9e169d', '#cc4a74', '#eb7852', '#fcb431'],
  p4: ['#a1a9d0', '#f0988c', '#b883d3', '#9e9e9e', '#cfeaf1', '#c4a5de', '#f6cae5', '#96cccb'],
  p5: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf']
};
const MODEL_CATALOG = {
  'gpt-6-astra': { provider: 'openai', endpoint: 'https://api.openai.com/v1', protocol: 'openai-responses' },
  'claude-fable-5-1': { provider: 'anthropic', endpoint: 'https://api.anthropic.com/v1', protocol: 'anthropic-messages' },
  'kimi-k2.7-code': { provider: 'moonshot', endpoint: 'https://api.moonshot.cn/v1', protocol: 'openai-chat' },
  'glm-5.3': { provider: 'zhipu', endpoint: 'https://open.bigmodel.cn/api/paas/v4', protocol: 'openai-chat' },
  'glm-5.3-flash': { provider: 'zhipu', endpoint: 'https://open.bigmodel.cn/api/paas/v4', protocol: 'openai-chat' },
  'gpt-5.6-sol': { provider: 'openai', endpoint: 'https://api.openai.com/v1', protocol: 'openai-responses' },
  'gpt-5.6-terra': { provider: 'openai', endpoint: 'https://api.openai.com/v1', protocol: 'openai-responses' },
  'gpt-5.6-luna': { provider: 'openai', endpoint: 'https://api.openai.com/v1', protocol: 'openai-responses' },
  'gpt-5.5': { provider: 'openai', endpoint: 'https://api.openai.com/v1', protocol: 'openai-responses' },
  'claude-fable-5': { provider: 'anthropic', endpoint: 'https://api.anthropic.com/v1', protocol: 'anthropic-messages' },
  'claude-opus-5': { provider: 'anthropic', endpoint: 'https://api.anthropic.com/v1', protocol: 'anthropic-messages' },
  'claude-sonnet-5': { provider: 'anthropic', endpoint: 'https://api.anthropic.com/v1', protocol: 'anthropic-messages' },
  'claude-haiku-4-5-20251001': { provider: 'anthropic', endpoint: 'https://api.anthropic.com/v1', protocol: 'anthropic-messages' },
  'kimi-k3': { provider: 'moonshot', endpoint: 'https://api.moonshot.cn/v1', protocol: 'openai-chat' },
  'kimi-k2.6': { provider: 'moonshot', endpoint: 'https://api.moonshot.cn/v1', protocol: 'openai-chat' },
  'qwen3.8-max': { provider: 'qwen', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', protocol: 'openai-chat' },
  'qwen3.7-plus': { provider: 'qwen', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', protocol: 'openai-chat' },
  'qwen3.7-flash': { provider: 'qwen', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', protocol: 'openai-chat' },
  'qwen3-coder-next': { provider: 'qwen', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', protocol: 'openai-chat' },
  'deepseek-v4-pro': { provider: 'deepseek', endpoint: 'https://api.deepseek.com', protocol: 'openai-chat' },
  'deepseek-v4-flash': { provider: 'deepseek', endpoint: 'https://api.deepseek.com', protocol: 'openai-chat' },
  'deepseek-flash': { provider: 'deepseek', endpoint: 'https://api.deepseek.com', protocol: 'openai-chat' },
  'doubao-seed-2-1-pro-260628': { provider: 'doubao', endpoint: 'https://ark.cn-beijing.volces.com/api/v3', protocol: 'openai-chat' },
  'doubao-seed-2-1-turbo': { provider: 'doubao', endpoint: 'https://ark.cn-beijing.volces.com/api/v3', protocol: 'openai-chat' },
  'doubao-seed-evolving': { provider: 'doubao', endpoint: 'https://ark.cn-beijing.volces.com/api/v3', protocol: 'openai-chat' }
};
const MODEL_GROUPS = [
  ['OpenAI', ['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5']],
  ['Anthropic', ['claude-fable-5-1', 'claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001']],
  ['Kimi', ['kimi-k3', 'kimi-k2.6', 'kimi-k2.7-code']],
  ['Zhipu / GLM', ['glm-5.3', 'glm-5.3-flash']],
  ['Qwen', ['qwen3.8-max', 'qwen3.7-plus', 'qwen3.7-flash', 'qwen3-coder-next']],
  ['DeepSeek', ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-v4-flash']],
  ['Doubao', ['doubao-seed-2-1-pro-260628', 'doubao-seed-2-1-turbo', 'doubao-seed-evolving']]
];
const MODEL_NAMES = {
  'gpt-6-astra': 'GPT-6 Astra', 'claude-fable-5-1': 'Claude Fable 5.1',
  'kimi-k2.7-code': 'Kimi K2.7 Code', 'glm-5.3': 'GLM-5.3', 'glm-5.3-flash': 'GLM-5.3-Flash',
  'gpt-5.6-sol': 'GPT-5.6 Sol', 'gpt-5.6-terra': 'GPT-5.6 Terra', 'gpt-5.6-luna': 'GPT-5.6 Luna', 'gpt-5.5': 'GPT-5.5',
  'claude-fable-5': 'Claude Fable 5', 'claude-opus-5': 'Claude Opus 5', 'claude-sonnet-5': 'Claude Sonnet 5', 'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
  'kimi-k3': 'Kimi K3', 'kimi-k2.6': 'Kimi K2.6',
  'qwen3.8-max': 'Qwen 3.8 Max', 'qwen3.7-plus': 'Qwen 3.7 Plus', 'qwen3.7-flash': 'Qwen 3.7 Flash', 'qwen3-coder-next': 'Qwen3 Coder Next',
  'deepseek-v4-pro': 'DeepSeek V4 Pro', 'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'deepseek-flash': 'DeepSeek V4.1 Flash',
  'doubao-seed-2-1-pro-260628': 'Doubao Seed 2.1 Pro', 'doubao-seed-2-1-turbo': 'Doubao Seed 2.1 Turbo', 'doubao-seed-evolving': 'Doubao Seed Evolving'
};
const MODEL_OPTIONS = `${MODEL_GROUPS.map(([label, ids]) => `<optgroup label="${label}">${ids.map((id) => `<option value="${id}">${MODEL_NAMES[id] || id}</option>`).join('')}</optgroup>`).join('')}<option value="custom">自定义</option>`;
const BRAND_MARK = new URL('./assets/brand/litgraph-mark.png', import.meta.url).href;
const CANVAS_FONT_STACK = 'system-ui';
const I18N = {
  zh: {
    workspace: 'LitGraph', semantic: '观点图', timeline: '年份树', table: '数据', local: 'AI 未配置',
    papers: '论文', relations: '关系', fulltext: '全文', search: '搜索论文、作者或 DOI…',
    viewMode: '查看方式', appearance: '显示', nodes: '节点', edges: '边', labels: '标签', filters: '筛选', statistics: '统计', data: '数据与导出',
    support: '支持', oppose: '反对', related: '相关', citations: '被引', lock: '锁定节点位置', multi: '自由多选', box: '框选论文',
    zoomIn: '放大', zoomOut: '缩小', fit: '适应画布', fullscreen: '画布全屏', edit: '重命名节点', background: '背景'
  },
  en: {
    workspace: 'LitGraph', semantic: 'Graph', timeline: 'Timeline', table: 'Data', local: 'AI not configured',
    papers: 'Papers', relations: 'Edges', fulltext: 'Full text', search: 'Search papers, authors, or DOI…',
    viewMode: 'View mode', appearance: 'Appearance', nodes: 'Nodes', edges: 'Edges', labels: 'Labels', filters: 'Filters', statistics: 'Statistics', data: 'Data & export',
    support: 'Supports', oppose: 'Opposes', related: 'Related', citations: 'Citations', lock: 'Lock node positions', multi: 'Multi-select', box: 'Box select',
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit graph', fullscreen: 'Canvas fullscreen', edit: 'Rename node', background: 'Background'
  }
};
const CLUSTER_ANCHORS = [
  [-0.72, -0.08], [-0.3, -0.56], [0.08, -0.25], [0.5, -0.52],
  [-0.08, 0.18], [0.35, 0.48], [-0.55, 0.44], [0.72, 0.12]
];

const app = document.querySelector('#app');
app.innerHTML = `
  <main class="app-shell">
    <div class="desktop-titlebar" role="banner" aria-label="LitGraph 桌面窗口">
      <div class="desktop-app-title"><img src="${BRAND_MARK}" alt=""><span>LitGraph</span></div>
      <div class="desktop-window-controls" aria-label="窗口控制">
        <button id="window-minimize" type="button" aria-label="最小化窗口" title="最小化"><svg viewBox="0 0 12 12"><path d="M2 8.5h8"/></svg></button>
        <button id="window-maximize" type="button" aria-label="最大化窗口" title="最大化"><svg viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7"/></svg></button>
        <button id="window-close" type="button" aria-label="关闭窗口" title="关闭"><svg viewBox="0 0 12 12"><path d="m2.5 2.5 7 7m0-7-7 7"/></svg></button>
      </div>
    </div>
    <a class="skip-link" href="#graph-canvas">跳到图谱画布</a>
    <header class="topbar">
      <nav class="view-tabs" aria-label="图谱视图">
        <button class="active" data-view="semantic" aria-pressed="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="2.2"/><circle cx="5" cy="5" r="1.7"/><circle cx="19" cy="5" r="1.7"/><circle cx="5" cy="19" r="1.7"/><circle cx="19" cy="19" r="1.7"/><path d="m10.4 10.4-4.2-4.2m7.4 4.2 4.2-4.2m-7.4 7.4-4.2 4.2m7.4-4.2 4.2 4.2"/></svg>
          <span data-i18n="semantic">观点图</span>
        </button>
        <button data-view="timeline" aria-pressed="false">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4v16M5 7h5M5 12h9M5 17h13"/></svg>
          <span data-i18n="timeline">年份树</span>
        </button>
        <button data-view="table" aria-pressed="false">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M9 9v11"/></svg>
          <span data-i18n="table">数据</span>
        </button>
      </nav>
      <div class="topbar-tools">
        <button class="topbar-select" id="theme-button" type="button" aria-label="切换日间和夜间模式" aria-pressed="false">
          <svg class="sun-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>
          <svg class="moon-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/></svg>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m7 10 5 5 5-5"/></svg>
        </button>
        <button class="topbar-select language-button" id="language-button" type="button" aria-label="切换界面语言"><span id="language-label">中 / EN</span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m7 10 5 5 5-5"/></svg></button>
        <span class="local-badge" id="model-badge" role="status" aria-live="polite"><i></i><span id="model-badge-label" data-i18n="local">本地 Demo</span></span>
      </div>
      <input id="file-input" type="file" accept="application/json,.json" hidden />
      <input id="document-input" type="file" accept=".pdf,.txt,.md,.tex,.csv,.json" multiple hidden />
    </header>
    <section class="workspace" id="workspace">
      <aside class="sidebar" aria-label="图谱控制">
        <div class="sidebar-brand" aria-label="LitGraph">
          <img class="brand-mark" src="${BRAND_MARK}" alt="">
          <span class="brand-wordmark">LitGraph</span>
        </div>
        <section class="project-summary">
          <div class="project-selector-wrap">
            <button class="project-selector" id="project-selector-button" type="button" aria-haspopup="menu" aria-expanded="false">
              <span id="project-selector-label">新建项目</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m7 10 5 5 5-5"/></svg>
            </button>
            <div class="project-selector-menu" id="project-selector-menu" role="menu" hidden>
              <p>已有项目</p>
              <button type="button" role="menuitem" data-project-action="current"><span id="project-selector-current-name">当前研究项目</span><i id="project-selector-current-count">0 篇</i></button>
              <div></div>
              <button type="button" role="menuitem" data-project-action="new">新建项目</button>
              <button type="button" role="menuitem" data-project-action="rename">重命名当前项目</button>
              <button type="button" role="menuitem" data-project-action="delete">删除当前项目</button>
            </div>
          </div>
          <div class="project-overview-stats" aria-label="项目统计">
            <div><span data-i18n="papers">论文</span><strong id="node-count">0</strong></div>
            <div><span data-i18n="relations">关系</span><strong id="edge-count">0</strong></div>
          </div>
          <h1 id="project-title" hidden>研究主题加载中</h1>
          <span id="fulltext-count" hidden>0</span>
        </section>

        <label class="sidebar-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="search-input" name="paper-search" aria-label="搜索论文、作者或 DOI" autocomplete="off" spellcheck="false" placeholder="搜索论文、作者或 DOI…" />
        </label>

        <div class="sidebar-sections">
          <section class="nav-group display-group">
            <button class="nav-heading display-toggle" id="display-toggle" type="button" aria-expanded="false" aria-controls="display-submenu"><span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3a9 9 0 1 0 0 18h1.4a1.6 1.6 0 0 0 0-3.2h-.7a1.5 1.5 0 0 1 0-3H15a6 6 0 0 0 6-6c0-3.2-3.6-5.8-9-5.8Z"/></svg><span data-i18n="appearance">显示</span></span><svg class="display-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18 6-6-6-6"/></svg></button>
            <div class="display-submenu" id="display-submenu" aria-hidden="true" inert><div class="display-submenu-inner">
              <button class="sidebar-nav" data-panel="view-mode" type="button"><span data-i18n="viewMode">查看方式</span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18 6-6-6-6"/></svg></button>
              <button class="sidebar-nav" data-panel="nodes" type="button"><span data-i18n="nodes">节点</span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18 6-6-6-6"/></svg></button>
              <button class="sidebar-nav" data-panel="edges" type="button"><span data-i18n="edges">边</span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18 6-6-6-6"/></svg></button>
              <button class="sidebar-nav" data-panel="labels" type="button"><span data-i18n="labels">标签</span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18 6-6-6-6"/></svg></button>
              <button class="sidebar-nav" data-panel="background" type="button"><span data-i18n="background">背景</span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18 6-6-6-6"/></svg></button>
            </div></div>
          </section>
          <button class="sidebar-section-button" data-panel="filters" type="button"><span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z"/></svg><span data-i18n="filters">筛选</span></span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18 6-6-6-6"/></svg></button>
          <button class="sidebar-section-button" data-panel="statistics" type="button"><span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 20V10M12 20V4M19 20v-7"/></svg><span data-i18n="statistics">统计</span></span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18 6-6-6-6"/></svg></button>
          <button class="sidebar-section-button" data-panel="literature-discovery" type="button"><span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6"/></svg><span>文献发现</span></span><i class="sidebar-ai-badge">AI</i></button>
          <button class="sidebar-section-button research-space-entry" id="research-desk-entry" type="button"><span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m12 3 1.5 4.1L18 9l-4.5 1.9L12 15l-1.5-4.1L6 9l4.5-1.9L12 3Z"/><path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></svg><span class="research-space-label">研究空间</span></span><i class="sidebar-ai-badge">AI</i></button>
          <button class="sidebar-section-button settings-entry" data-panel="workspace-settings" type="button"><span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg><span>设置</span></span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18 6-6-6-6"/></svg></button>
        </div>
        <button class="add-papers-button" id="add-papers-button" type="button">
          <span class="add-papers-progress" aria-hidden="true"></span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>
          <span class="add-papers-label">添加论文</span>
          <span class="add-papers-count" aria-live="polite"></span>
        </button>
      </aside>

      <div class="sidebar-resizer" id="sidebar-resizer" role="separator" aria-label="调整左侧栏宽度" aria-orientation="vertical"></div>

      <aside class="secondary-panel" id="secondary-panel" aria-label="详细设置" aria-hidden="true"></aside>

      <section class="graph-stage" id="graph-stage">
        <canvas class="graph-canvas" id="graph-canvas" tabindex="0" aria-label="论文关系力导向图" aria-describedby="canvas-instructions"></canvas>
        <div class="graph-3d" id="graph-3d" role="application" tabindex="0" aria-label="论文关系三维图" aria-describedby="graph-3d-keys" hidden></div>
        <div class="graph-3d-status" id="graph-3d-status" role="status" aria-live="polite" hidden><i></i><span>正在构建三维图谱…</span></div>
        <div class="canvas-tools" aria-label="画布工具">
          <div class="tool-stack mode-stack">
            <button id="edit-mode-button" type="button" title="重命名节点" aria-label="重命名节点" aria-pressed="false"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button>
            <button id="multi-select-button" type="button" title="自由多选" aria-label="自由多选" aria-pressed="false"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4.5 10.5 3 3 5.2-6"/><path d="m10.5 15.2 3 3 6-7"/></svg></button>
            <button id="box-select-button" type="button" title="框选论文" aria-label="框选论文" aria-pressed="false"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2"><rect x="4" y="4" width="16" height="16" rx="1"/></svg></button>
            <button id="lock-button" type="button" title="锁定节点位置" aria-label="锁定节点位置" aria-pressed="false"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></button>
            <button id="delete-papers-button" type="button" title="删除选中文献" aria-label="删除选中文献" disabled><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg></button>
          </div>
          <div class="tool-stack zoom-stack">
            <button id="zoom-in-button" type="button" title="放大" aria-label="放大"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M7.5 10.5h6M10.5 7.5v6"/></svg></button>
            <button id="zoom-out-button" type="button" title="缩小" aria-label="缩小"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M7.5 10.5h6"/></svg></button>
            <button id="canvas-fit-button" type="button" title="适应画布" aria-label="适应画布"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/></svg></button>
            <button id="fullscreen-button" type="button" title="画布全屏" aria-label="画布全屏" aria-pressed="false"><svg class="enter-fullscreen-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg><svg class="exit-fullscreen-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 8H3V3M16 8h5V3M8 16H3v5M16 16h5v5"/></svg></button>
          </div>
        </div>
        <div class="canvas-legend-row">
        <div class="graph-3d-keys" id="graph-3d-keys" hidden></div>
        <div class="graph-legend" aria-label="图谱图例">
          <span><i class="legend-line support"></i><b data-i18n="support">支持</b></span>
          <span><i class="legend-line oppose"></i><b data-i18n="oppose">反对</b></span>
          <span><i class="legend-line related-strong"></i><b>强相关</b></span>
          <span><i class="legend-line related-weak"></i><b>弱相关</b></span>
          <span class="legend-separator"></span>
          <span><i class="size-sample small"></i><i class="size-sample large"></i>节点大小＝被引量</span>
          <span><i class="depth-sample"></i>颜色深浅＝与主要理论的关联强度</span>
        </div>
        </div>
        <aside class="inspector" id="inspector" aria-live="polite"><div class="inspector-resizer" id="inspector-resizer" role="separator" aria-label="调整详情栏宽度"></div></aside>
        <section class="data-view" id="data-view" hidden></section>
        <div class="floating-window-layer" id="floating-window-layer"></div>
        <div class="drop-overlay" id="drop-overlay"><strong>拖入论文原文</strong><span>支持 PDF、Markdown、TXT、LaTeX、CSV 与 JSON</span></div>
        <div class="empty-canvas" id="empty-canvas" hidden><div><strong>这是一个空白 LitGraph 项目</strong><p>选择一种方式开始构建你的论文图谱。</p><div class="empty-project-actions"><button id="empty-model-access" type="button"><span>模型接入</span><small>连接外部 Agent 或 API</small></button><button id="empty-sample-project" type="button"><span>样例数据</span><small>从示例开始探索</small></button><button id="empty-literature-discovery" type="button"><span>文献发现</span><small>按研究主题查找论文</small></button><button id="choose-documents-button" type="button"><span>选择论文文件</span><small>导入本地论文</small></button></div></div></div>
        <div class="node-edit-popover" id="node-edit-popover" hidden><label for="node-label-input">论文标签</label><input id="node-label-input" name="node-label" autocomplete="off"><button id="save-node-label" type="button">保存标签</button></div>
        <div class="tooltip" id="tooltip"></div>
        <div class="selection-box" id="selection-box"></div>
        <span id="canvas-instructions" hidden>滚轮缩放、拖动背景平移、拖动论文并固定、单击查看详情；编辑模式下单击论文可修改标签</span>
        <div class="toast" id="toast" aria-live="polite"></div>
      </section>
    </section>
    <div class="modal-backdrop" id="api-modal" hidden>
      <section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="api-dialog-title">
        <header><div><h2 id="api-dialog-title">模型接入</h2><p>连接外部 Agent 或模型 API，开始检索与研究。</p></div><button type="button" data-close-modal="api" aria-label="关闭">×</button></header>
        <form id="api-form">
          <section class="external-agent-section" aria-labelledby="external-agent-label">
            <h3 id="external-agent-label">方式2：外部 Agent</h3>
            <p class="external-agent-help">先登录官方 Codex 或 Claude Code，再测试并保存。连接后，检索、论文分析和研究问答会按需调用。</p>
            <label for="agent-runtime-provider">外部 Agent 工具</label>
            <div class="external-agent-row agent-runtime-controls"><select id="agent-runtime-provider" aria-describedby="agent-error"><option value="codex">Codex CLI</option><option value="claude">Claude Code</option></select><button id="choose-agent-runtime" type="button">选择程序</button></div>
            <details class="manual-agent-access"><summary>其他工具：手动 MCP 接入</summary><div class="external-agent-row"><p>仅用于能持续处理 MCP 任务的工具；普通 MCP 连接无法自动唤醒聊天会话。</p><button id="copy-agent-instructions" type="button">复制文本</button></div></details>
            <div class="external-agent-status" id="external-agent-status" role="status"></div>
            <div class="form-error" id="agent-error" role="alert" tabindex="-1" hidden></div>
            <footer><button id="disconnect-agent" type="button" hidden>断开外部 Agent</button><button class="primary" id="connect-agent-runtime" type="button">测试并保存</button></footer>
          </section>
          <section class="api-method-section" aria-labelledby="api-method-label">
          <div class="connection-method-heading"><h3 class="connection-method-title" id="api-method-label">方式1：API <span class="connection-recommended">推荐</span></h3><button id="delete-api-config" type="button">删除该配置</button></div>
          <p class="api-provider-help">支持 OpenAI、Claude、Deepseek、Qwen等。密钥仅保存在当前设备。</p>
          <label for="api-endpoint">API 地址 (Base URL)</label><input id="api-endpoint" name="endpoint" type="url" autocomplete="off" spellcheck="false" required aria-describedby="api-error" value="">
          <label for="api-key">API Key</label><div class="secret-input"><input id="api-key" name="api-key" type="password" autocomplete="off" spellcheck="false" required aria-describedby="api-error"><button id="toggle-api-key" type="button" aria-label="显示 API Key" aria-pressed="false">显示</button></div>
          <label for="api-model">模型</label><select id="api-model" name="model" required aria-describedby="api-error">${MODEL_OPTIONS}</select>
          <input id="custom-model" name="custom-model" autocomplete="off" spellcheck="false" aria-label="自定义模型 ID" aria-describedby="api-error" placeholder="输入模型 ID…" hidden>
          <label class="api-vision-option"><input id="api-vision" type="checkbox">当前模型支持图片输入（请根据服务商说明确认）</label>
          <div class="form-error" id="api-error" role="alert" tabindex="-1" hidden></div>
          <footer><button type="button" data-close-modal="api">取消</button><button class="primary" id="test-api-button" type="submit">测试并保存</button></footer>
          </section>
        </form>
      </section>
    </div>
    <div class="modal-backdrop" id="about-modal" hidden>
      <section class="settings-dialog about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-dialog-title">
        <header><div><h2 id="about-dialog-title">关于 LitGraph</h2><p>Version ${APP_VERSION}</p></div><button type="button" data-close-modal="about" aria-label="关闭">×</button></header>
        <div class="about-content"><p>LitGraph 是面向文献综述、理论比较与研究空白发现的本地论文可视化工作台。它把论文、观点、理论类别与关系放进一张可以直接操作的图谱。</p><p>从文献发现、原文导入到二维与三维图谱，LitGraph 帮助你梳理研究脉络、比较观点与方法，并围绕单篇或多篇论文开展原文问答。论文原文、转换后的文本与分析结果保存在本机，可接入自己的模型 API 或外部 Agent。</p><p>项目开源、免费，允许学习、修改与再发布。如果它对你有帮助，欢迎前往 GitHub 点一个 Star。</p></div>
      </section>
    </div>
    <div class="modal-backdrop" id="paper-import-modal" hidden>
      <section class="settings-dialog paper-import-dialog" role="dialog" aria-modal="true" aria-labelledby="paper-import-title">
        <header><div><h2 id="paper-import-title">添加论文</h2><p>保存原文，转换为 MD 并分析，自动更新论文图谱。</p></div><div class="paper-import-header-actions"><button id="paper-import-history-toggle" type="button" aria-label="论文导入历史" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6m3-4v6l4 2"/></svg></button><button type="button" data-close-modal="paper-import" aria-label="关闭">×</button></div></header>
        <div class="paper-import-body">
          <div class="paper-dropzone" id="paper-dropzone" tabindex="0" role="button" aria-label="拖放或选择论文文件">
            <span class="paper-file-icon"><svg width="31" height="31" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3"/></svg></span>
            <strong>将论文文件拖到这里</strong>
            <p>支持 PDF、Markdown、TXT、LaTeX、CSV 与 JSON</p>
            <button id="paper-file-picker" type="button">选择文件</button>
          </div>
          <div class="paper-file-list" id="paper-file-list" aria-live="polite"></div>
        </div>
        <div id="paper-import-history" hidden></div>
        <footer><button type="button" data-close-modal="paper-import">取消</button><button class="primary" id="start-paper-import" type="button" disabled>完成</button></footer>
      </section>
    </div>
  </main>
`;

// Keep keyboard traversal in the same order as the two connection methods.
app.querySelector('#api-form').append(app.querySelector('.external-agent-section'));
const repositoryLink = document.createElement('a');
repositoryLink.href = 'https://github.com/AOBI8001/LitGraph';
repositoryLink.textContent = repositoryLink.href;
repositoryLink.target = '_blank';
repositoryLink.rel = 'noopener noreferrer';
app.querySelector('.about-content p:last-child').append(' ', repositoryLink);
app.querySelectorAll('svg').forEach((icon) => icon.setAttribute('aria-hidden', 'true'));
const translateStaticUI = captureStaticUI(app);

const workspace = document.querySelector('#graph-stage');
const canvas = document.querySelector('#graph-canvas');
const context = canvas.getContext('2d', { alpha: false });
const graph3dHost = document.querySelector('#graph-3d');
const inspector = document.querySelector('#inspector');
const tooltip = document.querySelector('#tooltip');
const secondaryPanel = document.querySelector('#secondary-panel');
const selectionBox = document.querySelector('#selection-box');
const searchInput = document.querySelector('#search-input');
const dataView = document.querySelector('#data-view');
const floatingWindowLayer = document.querySelector('#floating-window-layer');
const dropOverlay = document.querySelector('#drop-overlay');
const emptyCanvas = document.querySelector('#empty-canvas');
const nodeEditPopover = document.querySelector('#node-edit-popover');
const contextHelpTooltip = document.createElement('div');
contextHelpTooltip.className = 'context-help-tooltip';
contextHelpTooltip.setAttribute('role', 'tooltip');
contextHelpTooltip.hidden = true;
document.body.appendChild(contextHelpTooltip);

inspector.addEventListener('pointerup', (event) => {
  if (!event.target.closest('#close-inspector')) return;
  event.preventDefault();
  event.stopPropagation();
  closeInspectorPanel();
}, { capture: true });

let activeHelpTip = null;

function showContextHelp(target) {
  const message = target?.dataset.helpText;
  if (!message) return;
  activeHelpTip = target;
  contextHelpTooltip.textContent = message;
  contextHelpTooltip.hidden = false;
  contextHelpTooltip.style.maxWidth = `${Math.max(180, Math.min(280, window.innerWidth - 24))}px`;
  contextHelpTooltip.style.left = '0px';
  contextHelpTooltip.style.top = '0px';
  const anchor = target.getBoundingClientRect();
  const tooltipBounds = contextHelpTooltip.getBoundingClientRect();
  const margin = 12;
  let left = anchor.left;
  let top = anchor.bottom + 7;
  if (left + tooltipBounds.width > window.innerWidth - margin) left = window.innerWidth - tooltipBounds.width - margin;
  if (top + tooltipBounds.height > window.innerHeight - margin) top = anchor.top - tooltipBounds.height - 7;
  contextHelpTooltip.style.left = `${Math.max(margin, left)}px`;
  contextHelpTooltip.style.top = `${Math.max(margin, top)}px`;
}

function hideContextHelp(target = activeHelpTip) {
  if (target && activeHelpTip !== target) return;
  activeHelpTip = null;
  contextHelpTooltip.hidden = true;
}

secondaryPanel.addEventListener('pointerover', (event) => {
  const target = event.target.closest('.help-tip[data-help-text]');
  if (target && !target.contains(event.relatedTarget)) showContextHelp(target);
});
secondaryPanel.addEventListener('pointerout', (event) => {
  const target = event.target.closest('.help-tip[data-help-text]');
  if (target && !target.contains(event.relatedTarget)) hideContextHelp(target);
});
secondaryPanel.addEventListener('focusin', (event) => {
  const target = event.target.closest('.help-tip[data-help-text]');
  if (target) showContextHelp(target);
});
secondaryPanel.addEventListener('focusout', (event) => {
  const target = event.target.closest('.help-tip[data-help-text]');
  if (target) hideContextHelp(target);
});
secondaryPanel.addEventListener('scroll', () => hideContextHelp(), true);
window.addEventListener('resize', () => hideContextHelp());

const PROJECT_LIBRARY_KEY = 'litgraph.projects.v1';
const ACTIVE_PROJECT_KEY = 'litgraph.activeProjectId';
const SAMPLE_PROJECT_ID = 'sample-project';
function createSampleProject() {
  const sample = JSON.parse(JSON.stringify(sampleProjectSource));
  sample.meta = { ...(sample.meta || {}), id: SAMPLE_PROJECT_ID, title: '样例项目', titleZh: '样例项目', mock: sample.meta?.mock ?? true };
  return sample;
}
let projectLibrary = {};
try { projectLibrary = JSON.parse(localStorage.getItem(PROJECT_LIBRARY_KEY) || '{}') || {}; } catch { projectLibrary = {}; }
for (const entry of Object.values(projectLibrary)) if (entry?.data?.nodes) entry.data = refreshSampleNodes(entry.data, sampleProjectSource);
const initial = initialWorkspace(projectLibrary, localStorage.getItem(ACTIVE_PROJECT_KEY), createSampleProject(), localStorage.getItem('litgraph.language') || 'zh');
projectLibrary = initial.library;
let currentProjectId = initial.activeId;
let project = initial.project;
project.meta ??= { title: 'LitGraph 项目', mock: false };
project.meta.id ??= currentProjectId;
let nodes = [];
let activeLinks = [];
let view = 'semantic';
let graphView = 'semantic';
let selectedNode = null;
let hoveredNode = null;
let searchNodes = new Set();
let width = 1000;
let height = 700;
let deviceScale = 1;
let camera = { x: 0, y: 0, k: 1 };
let enabledTheories = new Set();
let enabledRelations = new Set(['support', 'oppose', 'related']);
let draggingNode = null;
let panning = false;
let pointerDown = null;
let toastTimer = null;
let language = localStorage.getItem('litgraph.language') === 'en' ? 'en' : 'zh';
let theme = 'light';
let canvasBackground = localStorage.getItem('litgraph.canvasBackground') || '';
let graphBackgroundTexture = null;
let graphBackgroundKey = '';
let modelRotation = null;
const summaryTranslations = new Map();
const currentBackground = () => backgroundPreset(canvasBackground || theme);
const canvasIsDark = () => currentBackground().dark;
let activePanel = null;
let secondaryPanelCloseTimer = 0;
let renderMode = '2d';
let layoutBasis = 'argument';
let graph3d = null;
let graph3dDataKey = '';
let graph3dModulePromise = null;
let graph3dLabelModulePromise = null;
let graph3dThreeModulePromise = null;
let graph3dYearGuideGroup = null;
let graph3dThree = null;
let graph3dPointer = { x: 0, y: 0 };
let graph3dTooltipFrame = 0;
let vectorLinks = [];
const vectorCameras = { semantic: null, timeline: null };
const theory2dFraming = { semantic: null, timeline: null };
let interactionMode = null;
let graphLocked = false;
let fullscreenCanvas = false;
let selectedNodes = new Set();
let selectionRect = null;
let dataEntity = 'nodes';
let dataSelection = new Set();
let summaryWindowIndex = 0;
let editMode = false;
let editingNode = null;
let projectIsBlank = false;
let stagedImportFiles = [];
let pendingImportedNodes = [];
let importProgress = { processing: false, done: 0, total: 0, ready: false };
let discoveryWindow = null;
let discoveryResults = [];
let discoverySelected = new Set();
let discoveryStep = 'search';
let discoverySearching = false;
let discoveryImporting = false;
let receivingInstitution = false;
let discoveryController = null;
let discoveryProgress = '';
let discoverySplit = .4;
const expandedHistoryJobs = new Set();
const pendingOriginalFiles = new Map();
let discoveryHistory = restoreJobs(localStorage.getItem(HISTORY_KEY));
let activeDiscoveryJobId = null;
let discoveryHistoryOpen = false;
let draggedResearchTab = null;
let discoveryCustomCount = false;
let discoveryNotice = '';
let discoveryQuery = '';
let discoveryInstitutionOpen = false;
let discoveryInstitutionUrl = localStorage.getItem('litgraph.institutionLibraryUrl') || '';
let discoveryFilters = {
  resultCount: 20,
  yearStart: '2020',
  yearEnd: String(new Date().getFullYear()),
  language: 'any',
  articleType: 'any',
  source: 'open',
  sort: 'combined'
};
const UI_DENSITY_VERSION_KEY = 'litgraph.uiDensityVersion';
const UI_DENSITY_VERSION = 'native-zoom-125-v1';
const PAGE_SCALE = 1.25;
let sidebarWidth = Number(localStorage.getItem('litgraph.sidebarWidth')) || 220;
let inspectorWidth = Number(localStorage.getItem('litgraph.inspectorWidth')) || 360;
if (localStorage.getItem(UI_DENSITY_VERSION_KEY) !== UI_DENSITY_VERSION) {
  sidebarWidth = 220;
  inspectorWidth = 360;
  localStorage.setItem('litgraph.sidebarWidth', String(sidebarWidth));
  localStorage.setItem('litgraph.inspectorWidth', String(inspectorWidth));
  localStorage.setItem(UI_DENSITY_VERSION_KEY, UI_DENSITY_VERSION);
}
let aiConfig = desktop ? desktopBootstrap?.config : JSON.parse(localStorage.getItem('litgraph.aiConfig') || 'null');
let deepReadWindow = null;
const researchRequests = new Map();
const researchDrafts = new Map();
const researchAttachments = new Map();
const researchAttachmentLoads = new Set();
let researchTabs = [];
let activeResearchTabId = 'project';
const viewCameras = { semantic: null, timeline: null };
const viewRenderModes = { semantic: '2d', timeline: '2d' };
const viewLayoutBases = { semantic: 'argument', timeline: 'argument' };
const graph3dCameraStates = {
  semantic: { argument: null, semantic: null },
  timeline: { argument: null, semantic: null }
};
const graph3dInitialized = {
  semantic: { argument: false, semantic: false },
  timeline: { argument: false, semantic: false }
};
const filterState = { yearStart: '', yearEnd: '', journals: [], fulltext: 'all' };
const viewSettings = {
  semantic: { charge: 2000, nodeSize: 100, sizeDifference: 100, colorVibrance: 100, edgeWidth: 100, edgeVibrance: 120, edgePalette: 'e0', paperLabels: true, paperLabelSize: 100, paperLabelMode: 'authors-year', theoryLabels: true, theoryLabelSize: 100, readMarkers: true, palette: 'p0' },
  timeline: { charge: 2000, nodeSize: 100, sizeDifference: 100, colorVibrance: 100, edgeWidth: 100, edgeVibrance: 120, edgePalette: 'e0', yearSpacing: 100, cohortSpread: 430, showYearAxis: true, relationLayer: 'argument', paperLabels: true, paperLabelSize: 100, paperLabelMode: 'authors-year', theoryLabels: false, theoryLabelSize: 100, readMarkers: true, palette: 'p0' }
};
const dataColumnWidths = JSON.parse(localStorage.getItem('litgraph.dataColumnWidths') || '{}');
const DRAG_THRESHOLD = 5;

function settings() {
  return viewSettings[view === 'table' ? 'semantic' : view];
}

function t(key) {
  return I18N[language][key] ?? key;
}

const announcedAgentConnections = new Set();
function showAgentConnectedNotice(model) {
  document.querySelector('#agent-connected-dialog')?.close();
  const dialog=document.createElement('dialog');
  dialog.id='agent-connected-dialog';
  dialog.className='research-notice-dialog agent-connected-dialog';
  dialog.setAttribute('aria-labelledby','agent-connected-title');
  dialog.innerHTML=`<form method="dialog"><header><strong id="agent-connected-title">${panelText('外部 Agent 接入成功','External agent connected')}</strong><button aria-label="${panelText('关闭','Close')}">×</button></header><p class="agent-connected-model">${escapeHtml(model)}</p><p>${externalState().managed ? panelText('已启用按需调用。文献检索、导入分析和研究空间问答会自动启动独立任务，完成后退出，无须保持外部聊天运行。','On-demand execution is enabled. Searches, import analysis and research questions start independent tasks and exit when finished. No external chat needs to stay active.') : panelText('已完成手动 MCP 连接。请保持外部 Agent 的任务循环运行。','Manual MCP connected. Keep the external agent task loop running.')}</p><button class="primary">${panelText('开始使用','Get started')}</button></form>`;
  document.body.appendChild(dialog);
  dialog.addEventListener('close',()=>dialog.remove());
  dialog.showModal();
}
function updateModelBadge() {
  const badge = document.querySelector('#model-badge');
  const label = document.querySelector('#model-badge-label');
  badge.classList.toggle('connected', aiAvailable());
  label.textContent = externalState().connected ? externalState().model : aiConfig?.verified
    ? `${MODEL_NAMES[aiConfig.model] || aiConfig.model}`
    : t('local');
  badge.title = label.textContent;
  const agent=externalState();
  if(agent.connected && agent.connectionId && !announcedAgentConnections.has(agent.connectionId)){
    announcedAgentConnections.add(agent.connectionId);
    showAgentConnectedNotice(agent.model);
  }
  if(!agent.connected)document.querySelector('#agent-connected-dialog')?.close();
  const status = document.querySelector('#external-agent-status');
  if (status) {
    status.classList.toggle('connected', agent.connected);
    status.textContent = agent.connected ? agent.managed
      ? panelText(`按需调用已启用 · ${agent.model} · ${agent.processing ? '处理中' : '待命'}${agent.queued ? ` · 排队 ${agent.queued}` : ''}`, `On-demand ready · ${agent.model} · ${agent.processing ? 'Processing' : 'Idle'}${agent.queued ? ` · ${agent.queued} queued` : ''}`)
      : panelText(`已连接 · ${agent.model}（Agent 自报）`, `Connected · ${agent.model} (self-reported)`)
      : panelText('未连接 · 桌面版可验证并启用按需调用。', 'Not connected · Enable on-demand execution in the desktop app.');
  }
  const disconnect = document.querySelector('#disconnect-agent');
  if (disconnect) disconnect.hidden = !externalState().connected;
}

function aiAvailable() { return Boolean(externalState().connected || aiConfig?.verified); }
function activeAIConfig() { return externalState().connected ? { provider: 'external-agent', model: externalState().model, vision: externalState().vision } : { ...aiConfig }; }
function agentPageContext() {
  return { projectId: currentProjectId, title: project.meta?.title || '当前项目', papers: nodes.map(n => ({ id: n.id, title: n.title, year: n.year, doi: n.doi })), selectedIds: [...new Set([...selectedNodes, ...(selectedNode ? [selectedNode.id] : [])])] };
}

function updateResearchEntry() {
  const button = document.querySelector('#research-desk-entry');
  if (!button) return;
  const hasSelection = Boolean(selectedNode) || selectedNodes.size > 0;
  const count = selectedNodes.size || (selectedNode ? 1 : 0);
  button.classList.toggle('has-selection', hasSelection);
  button.setAttribute('aria-label', hasSelection
    ? panelText(`对当前选中的 ${count} 篇论文探索`, `Explore ${count} selected ${count === 1 ? 'paper' : 'papers'}`)
    : panelText('研究空间', 'Research space'));
  button.querySelector('.research-space-label').textContent = hasSelection
    ? panelText('对当前选中的论文探索', 'Explore selected papers')
    : panelText('研究空间', 'Research space');
  const badge = button.querySelector('.sidebar-ai-badge');
  if (badge) badge.textContent = hasSelection ? String(count) : 'AI';
}

async function callAI(messages, config = aiConfig, maxTokens = 240, options = {}) {
  if (!options.connectionTest && (config?.provider === 'external-agent' || (config === aiConfig && externalState().connected))) {
    await localRequest('context', agentPageContext());
    return externalCompletion(messages, maxTokens, options.signal, options.researchMode,options.onText);
  }
  if (!config?.endpoint || !config?.apiKey || !config?.model) throw new Error(panelText('AI API 尚未配置', 'AI API is not configured'));
  const endpoint = config.endpoint.replace(/\/+$/, '');
  const catalog = MODEL_CATALOG[config.model];
  const protocol = config.protocol || catalog?.protocol || 'openai-chat';
  const provider = config.provider || catalog?.provider || 'custom';
  const system = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
  const conversation = messages.filter((message) => message.role !== 'system');
  let url;
  let headers = { 'Content-Type': 'application/json' };
  let body;
  if (protocol === 'anthropic-messages') {
    url = /\/messages$/i.test(endpoint) ? endpoint : `${endpoint}/messages`;
    headers = { ...headers, 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
    body = { model: config.model, system, messages: conversation, max_tokens: maxTokens, temperature: 0.2 };
  } else if (protocol === 'openai-responses') {
    url = /\/responses$/i.test(endpoint) ? endpoint : `${endpoint}/responses`;
    headers.Authorization = `Bearer ${config.apiKey}`;
    body = { model: config.model, input: messages, max_output_tokens: maxTokens };
  } else {
    url = /\/chat\/completions$/i.test(endpoint) ? endpoint : `${endpoint}/chat/completions`;
    headers.Authorization = `Bearer ${config.apiKey}`;
    body = { model: config.model, messages, max_tokens: maxTokens, temperature: 0.2, stream: false };
    if (options.json && /deepseek/i.test(`${provider} ${config.model} ${endpoint}`)) body.response_format = { type: 'json_object' };
    if (options.connectionTest && /deepseek/i.test(`${provider} ${config.model} ${endpoint}`) && !/reasoner/i.test(config.model)) body.thinking = { type: 'disabled' };
  }
  if (options.researchMode || options.connectionTest) {
    const controls = researchThinkingOptions(config, protocol, options.researchMode || 'quick');
    Object.assign(body, controls);
    if (controls.thinking?.type === 'enabled') delete body.temperature;
  }
  compatibleModelBody(body,config,protocol,options);
  if(options.onText)body.stream=true;
  const streaming=options.onText?createTextStream(options.onText,{requireCompletion:true}):null;
  const response = await modelFetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
    onChunk:streaming?text=>streaming.push(text):undefined
  });
  if(streaming&&response.ok&&response.headers.get('content-type')?.includes('text/event-stream')){
    if(!desktop){const reader=response.body.getReader(),decoder=new TextDecoder();try{while(true){options.signal?.throwIfAborted();const {done,value}=await reader.read();if(done)break;streaming.push(decoder.decode(value,{stream:true}));}streaming.push(decoder.decode());}finally{reader.releaseLock();}}
    return streaming.finish();
  }
  return readAIResponse(response, protocol);
}

function openModal(id) {
  const modal = document.querySelector(`#${id}-modal`);
  modal.hidden = false;
  if (id === 'api') {
    document.querySelector('#api-vision').checked = aiConfig?.vision === true;
    document.querySelector('#api-endpoint').value = aiConfig?.endpoint || (aiConfig?.model ? '' : 'https://api.deepseek.com');
    const keyInput = document.querySelector('#api-key');
    const keyToggle = document.querySelector('#toggle-api-key');
    keyInput.value = aiConfig?.apiKey || '';
    keyInput.type = 'password';
    keyToggle.textContent = panelText('显示', 'Show');
    keyToggle.setAttribute('aria-label', panelText('显示 API Key', 'Show API key'));
    keyToggle.setAttribute('aria-pressed', 'false');
    const known = Object.keys(MODEL_CATALOG);
    document.querySelector('#api-model').value = known.includes(aiConfig?.model) ? aiConfig.model : aiConfig?.model ? 'custom' : 'deepseek-flash';
    document.querySelector('#custom-model').hidden = document.querySelector('#api-model').value !== 'custom';
    document.querySelector('#custom-model').value = known.includes(aiConfig?.model) ? '' : (aiConfig?.model || '');
    document.querySelector('#api-error').hidden = true;
    window.setTimeout(() => document.querySelector('#api-endpoint').focus(), 0);
  } else {
    window.setTimeout(() => modal.querySelector('[data-close-modal]').focus(), 0);
  }
}

function closeModal(id) {
  if(id==='paper-import')document.querySelector('#paper-import-history').innerHTML='';
  const modal = document.querySelector(`#${id}-modal`);
  if (modal) modal.hidden = true;
  const focusTarget = id === 'paper-import' ? document.querySelector('#add-papers-button') : document.querySelector('[data-panel="workspace-settings"]');
  focusTarget?.focus();
}

const simulation = forceSimulation()
  .alphaDecay(0.035)
  .velocityDecay(0.34)
  .on('tick', render);

function endpointId(endpoint) {
  return typeof endpoint === 'object' ? endpoint.id : endpoint;
}

function theoryById(id) {
  return project.theories.find((theory) => theory.id === id) ?? { id, label: id, color: '#87909b' };
}

function isNodeVisible(node) {
  if (node.importCanvasHidden) return false;
  if (!enabledTheories.has(node.primaryTheory)) return false;
  if (filterState.yearStart && Number(node.year) < Number(filterState.yearStart)) return false;
  if (filterState.yearEnd && Number(node.year) > Number(filterState.yearEnd)) return false;
  if (filterState.journals.length && !filterState.journals.includes(node.journal)) return false;
  const hasLocalText = Boolean(node.hasPdf || node.sampleMarkdown || node.fulltextStatus?.startsWith('indexed'));
  if (filterState.fulltext === 'yes' && !hasLocalText) return false;
  if (filterState.fulltext === 'no' && hasLocalText) return false;
  return true;
}

function visibleNodes() {
  return nodes.filter(isNodeVisible);
}

function usesSemanticLayout() {
  return layoutBasis === 'semantic';
}

function currentMasterLinks() {
  if (usesSemanticLayout()) return vectorLinks;
  if (view === 'timeline') return settings().relationLayer === 'argument' ? project.semanticLinks : project.citationLinks;
  return project.semanticLinks;
}

function currentLayoutLinks() {
  if (usesSemanticLayout()) return vectorLinks;
  return project.semanticLinks;
}

function visibleLink(link) {
  const source = nodes.find((node) => node.id === endpointId(link.source));
  const target = nodes.find((node) => node.id === endpointId(link.target));
  if (!source || !target || !isNodeVisible(source) || !isNodeVisible(target)) return false;
  return usesSemanticLayout() || (view === 'timeline' && settings().relationLayer !== 'argument') || enabledRelations.has(link.relation);
}

function rebuildActiveLinks() {
  activeLinks = currentMasterLinks()
    .filter(visibleLink)
    .map((link) => ({
      ...link,
      source: nodes.find((node) => node.id === endpointId(link.source)),
      target: nodes.find((node) => node.id === endpointId(link.target))
    }))
    .filter((link) => link.source && link.target);

}

function clusterPoint(node) {
  const index = Math.max(0, project.theories.findIndex((theory) => theory.id === node.primaryTheory));
  if (index < CLUSTER_ANCHORS.length) {
    const [x, y] = CLUSTER_ANCHORS[index];
    return { x: x * 430, y: y * 345 };
  }
  const ring = Math.floor(index / 8);
  const slot = index % 8;
  const angle = (slot / 8) * Math.PI * 2 - Math.PI / 2;
  const radius = 390 + ring * 165;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.78 };
}

function publicationValue(node) {
  return node.year ? Number(node.year) + (Math.max(1, Math.min(12, Number(node.month) || 6)) - 1) / 12 : NaN;
}

function yearPosition(value) {
  const years = nodes.filter(n=>!n.importCanvasHidden).map(publicationValue).filter(Number.isFinite);
  if(!years.length)return 0;
  const min = Math.floor(Math.min(...years));
  const max = Math.ceil(Math.max(...years));
  if (min === max) return 0;
  const span = Math.max(60, (max - min) * (settings().yearSpacing || 100));
  if(!Number.isFinite(value))return span/2+(settings().yearSpacing||100);
  return -span / 2 + ((value - min) / (max - min)) * span;
}

function vectorTokens(value = '') {
  const stop = new Set('the a an and or but if then than that this these those to of in on at by for from with without into during between among as is are was were be been being have has had do does did can could may might should would will its their our your not no we they it study studies paper article result results finding findings effect effects using used use based also however therefore whereas overall'.split(' '));
  return String(value).normalize('NFKC').toLowerCase().match(/[a-z][a-z-]{2,}|[\u3400-\u9fff]{2,}/g)?.filter((token) => !stop.has(token)) || [];
}

function buildVectorLinks() {
  const docs = nodes.filter(node=>!node.importCanvasHidden).map((node) => ({ node, tokens: vectorTokens(`${node.title} ${node.title} ${node.abstract || ''}`) }));
  const frequency = new Map();
  docs.forEach((doc) => new Set(doc.tokens).forEach((token) => frequency.set(token, (frequency.get(token) || 0) + 1)));
  docs.forEach((doc) => {
    const counts = new Map();
    doc.tokens.forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));
    doc.vector = new Map([...counts].map(([token, count]) => [token, (1 + Math.log(count)) * Math.log((docs.length + 1) / ((frequency.get(token) || 0) + 1))]));
    doc.node.semanticVector=Object.fromEntries(doc.vector);
    doc.node.semanticVectorMethod='tfidf_title_abstract';
  });
  const cosine = (left, right) => {
    let dot = 0; let a2 = 0; let b2 = 0;
    left.forEach((value) => { a2 += value * value; });
    right.forEach((value) => { b2 += value * value; });
    const [small, large] = left.size < right.size ? [left, right] : [right, left];
    small.forEach((value, token) => { dot += value * (large.get(token) || 0); });
    return a2 && b2 ? dot / Math.sqrt(a2 * b2) : 0;
  };
  const pairs = [];
  docs.forEach((doc, index) => {
    const nearest = docs.map((peer, peerIndex) => ({ peer, peerIndex, similarity: peerIndex === index ? -1 : cosine(doc.vector, peer.vector) }))
      .filter((item) => item.similarity >= 0.045)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
    nearest.forEach(({ peer, similarity }) => pairs.push({ source: doc.node.id, target: peer.node.id, similarity }));
  });
  const unique = new Map();
  pairs.forEach((pair) => {
    const key = [pair.source, pair.target].sort().join('|');
    if (!unique.has(key) || unique.get(key).similarity < pair.similarity) unique.set(key, pair);
  });
  const semanticPairs = [...unique.values()];
  const similarities = semanticPairs.map((pair) => pair.similarity).sort((a, b) => a - b);
  const quantile = (ratio) => {
    if (!similarities.length) return 0;
    const position = (similarities.length - 1) * ratio;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const mix = position - lower;
    return similarities[lower] * (1 - mix) + similarities[upper] * mix;
  };
  const similarityFloor = quantile(0.12);
  const similarityCeiling = quantile(0.88);
  const similaritySpan = Math.max(0.001, similarityCeiling - similarityFloor);
  vectorLinks = semanticPairs.map((pair, index) => {
    const semanticWeight = Math.max(0, Math.min(1, (pair.similarity - similarityFloor) / similaritySpan));
    return {
    id: `vector-${index + 1}`,
    ...pair,
    relation: 'related',
    strength: Math.max(1, Math.min(5, Math.round(1 + semanticWeight * 4))),
    confidence: pair.similarity,
    semanticWeight,
    vectorGenerated: true
    };
  });
}

function vectorPositionKey(targetView = view) {
  return targetView === 'timeline' ? 'vectorTimeline' : 'vectorSemantic';
}

function loadVectorPositions(targetView = view) {
  const positionKey = vectorPositionKey(targetView);
  nodes.forEach((node, index) => {
    node.viewPositions ??= {};
    const saved = node.viewPositions[positionKey];
    const angle = index * 2.3999632297;
    const radius = 38 + Math.sqrt(index + 1) * 28;
    node.x = saved?.x ?? Math.cos(angle) * radius;
    node.y = targetView === 'timeline' ? yearPosition(publicationValue(node)) : (saved?.y ?? Math.sin(angle) * radius);
    node.fx = saved?.fx ?? null;
    node.fy = targetView === 'timeline' ? node.y : (saved?.fy ?? null);
    node.vx = 0;
    node.vy = 0;
  });
  if (vectorCameras[targetView]) camera = { ...vectorCameras[targetView] };
}

function refreshTimelineCoordinates({ redistribute = false } = {}) {
  if (view !== 'timeline') return;
  const spread = Math.max(0, Number(settings().cohortSpread) || 430) / 100;
  nodes.forEach((node, index) => {
    const nextY = yearPosition(publicationValue(node));
    node.y = nextY;
    node.fy = nextY;
    node.vy = 0;
    if (redistribute && node.fx == null && !usesSemanticLayout()) {
      const anchor = clusterPoint(node);
      const jitter = ((index % 7) - 3) * 8;
      node.x = anchor.x * 0.72 * spread + jitter;
      node.vx = 0;
    }
    node.viewPositions ??= {};
    const key = usesSemanticLayout() ? vectorPositionKey('timeline') : 'timeline';
    node.viewPositions[key] = { x: node.x, fx: node.fx };
  });
}

function saveVectorState(targetView = view) {
  const positionKey = vectorPositionKey(targetView);
  nodes.forEach((node) => {
    node.viewPositions ??= {};
    node.viewPositions[positionKey] = targetView === 'timeline'
      ? { x: node.x, fx: node.fx }
      : { x: node.x, y: node.y, fx: node.fx, fy: node.fy };
  });
  vectorCameras[targetView] = { ...camera };
}

function initializePositions() {
  nodes.forEach((node, index) => {
    const anchor = clusterPoint(node);
    const angle = index * 2.3999632297;
    const radius = 18 + (index % 12) * 5.5;
    node.x = anchor.x + Math.cos(angle) * radius;
    node.y = anchor.y + Math.sin(angle) * radius;
    node.vx = 0;
    node.vy = 0;
    node.fx = null;
    node.fy = null;
    node.viewPositions ??= {};
    node.viewPositions.semantic = { x: node.x, y: node.y, fx: null, fy: null };
  });
}

function saveGraphState(targetView = view) {
  if (!['semantic', 'timeline'].includes(targetView)) return;
  nodes.forEach((node) => {
    node.viewPositions ??= {};
    node.viewPositions[targetView] = targetView === 'timeline'
      ? { x: node.x, fx: node.fx }
      : { x: node.x, y: node.y, fx: node.fx, fy: node.fy };
  });
  viewCameras[targetView] = { ...camera };
  theory2dFraming[targetView] = capture2dFraming(visibleNodes(), camera, width, height);
}

function loadGraphState(targetView) {
  if (targetView === 'semantic') {
    const missing = nodes.some((node) => !node.viewPositions?.semantic);
    if (missing) initializePositions();
    nodes.forEach((node) => {
      const saved = node.viewPositions.semantic;
      node.x = saved.x;
      node.y = saved.y;
      node.fx = saved.fx ?? null;
      node.fy = saved.fy ?? null;
      node.vx = 0;
      node.vy = 0;
    });
  } else {
    nodes.forEach((node, index) => {
      node.viewPositions ??= {};
      const saved = node.viewPositions.timeline;
      node.x = saved?.x ?? clusterPoint(node).x * 0.72 + ((index % 5) - 2) * 9;
      node.y = yearPosition(publicationValue(node));
      node.fx = saved?.fx ?? null;
      node.fy = node.y;
      node.vx = 0;
      node.vy = 0;
      node.viewPositions.timeline = { x: node.x, fx: node.fx };
    });
  }
  if (viewCameras[targetView]) camera = { ...viewCameras[targetView] };
}

function linkDistance(link) {
  if (usesSemanticLayout()) {
    const timelineScale = view === 'timeline' ? Math.max(0.35, (settings().cohortSpread || 430) / 430) : 1;
    const similarity = Math.max(0, Math.min(1, Number(link.semanticWeight ?? link.similarity) || 0));
    const closeness = Math.pow(similarity, 0.72);
    return (42 + (1 - closeness) * 126) * timelineScale;
  }
  if (view === 'timeline') return 50;
  if (link.relation === 'support') return 44;
  if (link.relation === 'oppose') return 68;
  return 90;
}

function linkStrength(link) {
  if (link?.displayOnly) return 0;
  if (usesSemanticLayout()) {
    const similarity = Math.max(0, Math.min(1, Number(link.semanticWeight ?? link.similarity) || 0));
    return 0.22 + Math.pow(similarity, 1.7) * 1.45;
  }
  if (view === 'timeline') return 0.12;
  return link.relation === 'support' ? 0.22 : link.relation === 'oppose' ? 0.13 : 0.08;
}

function configureSimulation(reheat = true) {
  rebuildActiveLinks();
  const layoutLinks = currentLayoutLinks()
    .filter((link) => {
      const source = nodes.find((node) => node.id === endpointId(link.source));
      const target = nodes.find((node) => node.id === endpointId(link.target));
      return source && target && isNodeVisible(source) && isNodeVisible(target) && (usesSemanticLayout() || enabledRelations.has(link.relation));
    })
    .map((link) => ({ ...link, source: endpointId(link.source), target: endpointId(link.target) }));
  const linkForce = forceLink(layoutLinks)
    .id((node) => node.id)
    .distance(linkDistance)
    .strength(linkStrength);

  const chargeStrength = usesSemanticLayout() ? settings().charge * 0.65 : settings().charge;
  simulation.nodes(visibleNodes())
    .force('link', linkForce)
    .force('charge', forceManyBody().strength(-chargeStrength).theta(0.9).distanceMax(1600))
    .force('collision', forceCollide().radius((node) => nodeRadius(node) + 5).strength(0.94).iterations(2))
    .force('center', forceCenter(0, 0));

  if (usesSemanticLayout() && view === 'timeline') {
    simulation
      .force('x', forceX(0).strength(0.008))
      .force('y', forceY((node) => yearPosition(publicationValue(node))).strength(1));
  } else if (usesSemanticLayout()) {
    simulation
      .force('x', forceX(0).strength(0.012))
      .force('y', forceY(0).strength(0.012));
  } else if (view === 'semantic') {
    simulation
      .force('x', forceX((node) => clusterPoint(node).x).strength(0.045))
      .force('y', forceY((node) => clusterPoint(node).y).strength(0.045));
  } else {
    const spread = (settings().cohortSpread || 100) / 100;
    simulation
      .force('x', forceX((node) => clusterPoint(node).x * 0.72 * spread).strength(0.022))
      .force('y', forceY((node) => yearPosition(publicationValue(node))).strength(1));
  }

  if (reheat) simulation.alpha(0.95).restart();
  updateCounters();
  render();
}

function settleSemantic2DLayout() {
  if (renderMode !== '2d' || !usesSemanticLayout()) return;
  const iterations = Math.max(30, Math.min(120, Math.round(10000 / Math.max(1, visibleNodes().length))));
  simulation.stop();
  simulation.tick(iterations);
  render();
}

function theoryAffinity(node) {
  const group = nodes.filter((item) => item.primaryTheory === node.primaryTheory);
  const values = group.map((item) => Number(item.theoryStrength ?? item.impact ?? 0.5));
  const raw = Number(node.theoryStrength ?? node.impact ?? 0.5);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(raw) || max - min < 0.025) return Math.max(0.38, Math.min(0.86, raw || 0.62));
  return 0.28 + ((raw - min) / (max - min)) * 0.72;
}

function nodeFill(node) {
  const theory = theoryById(node.primaryTheory);
  const strength = theoryAffinity(node);
  const base = canvasIsDark() ? '#32363b' : '#e7ebef';
  const colored = interpolateRgb(base, theory.color)(0.46 + strength * 0.54);
  return adjustVibrance(colored, settings().colorVibrance);
}

function relatedIsStrong(link) {
  if (link?.vectorGenerated) return Number(link.semanticWeight ?? link.similarity ?? 0) >= 0.62;
  return Number(link?.confidence ?? link?.similarity ?? 0) >= 0.28 || Number(link?.strength || 0) >= 3;
}

function edgeColor(linkOrRelation) {
  const link = typeof linkOrRelation === 'object' ? linkOrRelation : { relation: linkOrRelation };
  const palette = EDGE_PALETTES[settings().edgePalette] || EDGE_PALETTES.e0;
  const key = link.relation === 'related' ? (relatedIsStrong(link) ? 'relatedStrong' : 'relatedWeak') : link.relation;
  const original = palette[key] || '#89919a';
  if (key === 'relatedWeak') return '#909090';
  return adjustVibrance(original, settings().edgeVibrance);
}

function adjustVibrance(value, percent = 100) {
  const color = hsl(value);
  const amount = Math.max(0, Math.min(2, Number(percent) / 100));
  color.s = amount <= 1 ? color.s * amount : color.s + (1 - color.s) * (amount - 1);
  if (amount > 1) color.l += (0.5 - color.l) * 0.08 * (amount - 1);
  return color.formatHex();
}

function nodeRadius(node) {
  const citations = Math.max(0, Number(node?.citations) || 0);
  const percentile = Number(node?.citationPercentile);
  const rawScore = Number.isFinite(percentile)
    ? Math.max(0, Math.min(1, percentile / 100))
    : Math.min(1, Math.log1p(citations) / Math.log1p(3000));
  const difference = (settings().sizeDifference / 100) * 1.45;
  const shaped = Math.pow(rawScore, Math.max(0.38, 1.7 - difference));
  const overall = settings().nodeSize / 100;
  return (4.1 + shaped * (9.6 + difference * 5.4)) * overall;
}

function renderedNodeRadius(node) {
  return nodeRadius(node) / Math.sqrt(camera.k);
}

function drawYearGuides() {
  if (view !== 'timeline' || !settings().showYearAxis) return;
  const years = [...new Set(nodes.filter(n=>!n.importCanvasHidden&&n.year).map((node) => node.year))].sort((a, b) => a - b);
  const left = screenToWorld(0, 0).x;
  const right = screenToWorld(width, 0).x;
  context.save();
  context.font = `${10 / camera.k}px ${CANVAS_FONT_STACK}`;
  context.textAlign = 'left';
  context.textBaseline = 'bottom';
  years.forEach((year) => {
    const y = yearPosition(year);
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.strokeStyle = canvasIsDark() ? '#34383d' : '#e4e7ea';
    context.lineWidth = 1 / camera.k;
    context.stroke();
    context.fillStyle = canvasIsDark() ? '#89919a' : '#9299a2';
    context.fillText(String(year), left + 12 / camera.k, y - 5 / camera.k);
  });
  context.restore();
}

function drawTheoryGroupLabels() {
  if (!settings().theoryLabels || view !== 'semantic' || usesSemanticLayout()) return;
  const occupied = [];
  project.theories.forEach((theory) => {
    const group = visibleNodes().filter((node) => node.primaryTheory === theory.id);
    if (!group.length) return;
    const centerX = group.reduce((sum, node) => sum + node.x, 0) / group.length;
    const centerY = group.reduce((sum, node) => sum + node.y, 0) / group.length;
    const minX = Math.min(...group.map((node) => node.x - nodeRadius(node)));
    const maxX = Math.max(...group.map((node) => node.x + nodeRadius(node)));
    const minY = Math.min(...group.map((node) => node.y - nodeRadius(node)));
    const maxY = Math.max(...group.map((node) => node.y + nodeRadius(node)));
    context.save();
    const fontSize = (17 * settings().theoryLabelSize / 100) / Math.sqrt(camera.k);
    context.font = `700 ${fontSize}px ${CANVAS_FONT_STACK}`;
    const label = language === 'en' ? (theory.labelEn || theory.label) : theory.label;
    const labelWidth = context.measureText(label).width;
    const pad = 18 / camera.k;
    const candidates = [
      { x: centerX, y: minY - pad, align: 'center', baseline: 'bottom' },
      { x: maxX + pad, y: centerY, align: 'left', baseline: 'middle' },
      { x: minX - pad, y: centerY, align: 'right', baseline: 'middle' },
      { x: centerX, y: maxY + pad, align: 'center', baseline: 'top' }
    ];
    const placement = candidates.map((candidate) => {
      const left = candidate.align === 'left' ? candidate.x : candidate.align === 'right' ? candidate.x - labelWidth : candidate.x - labelWidth / 2;
      const top = candidate.baseline === 'top' ? candidate.y : candidate.baseline === 'bottom' ? candidate.y - fontSize : candidate.y - fontSize / 2;
      const box = { left, top, right: left + labelWidth, bottom: top + fontSize };
      const nodePenalty = visibleNodes().reduce((score, node) => {
        const radius = nodeRadius(node) + 9 / camera.k;
        return score + (node.x + radius > box.left && node.x - radius < box.right && node.y + radius > box.top && node.y - radius < box.bottom ? 1000 : 0);
      }, 0);
      const labelPenalty = occupied.reduce((score, item) => score + (item.right > box.left && item.left < box.right && item.bottom > box.top && item.top < box.bottom ? 1400 : 0), 0);
      return { ...candidate, box, score: nodePenalty + labelPenalty };
    }).sort((a, b) => a.score - b.score)[0];
    occupied.push(placement.box);
    context.textAlign = placement.align;
    context.textBaseline = placement.baseline;
    context.globalAlpha = 0.82;
    context.fillStyle = canvasIsDark() ? interpolateRgb(theory.color, '#ffffff')(0.38) : theory.color;
    context.fillText(label, placement.x, placement.y);
    context.restore();
  });
}

function drawLinks() {
  if (settings().edgeWidth <= 0) return;
  activeLinks.forEach((link) => {
    const source = link.source;
    const target = link.target;
    if (!source || !target) return;
    const incident = selectedNode && linkMatchesSelection(link, selectedNode);
    if (!linkMatchesSelection(link, selectedNode)) return;
    const argumentLayer = view === 'semantic' || (view === 'timeline' && settings().relationLayer === 'argument');
    const color = usesSemanticLayout() || argumentLayer ? edgeColor(link) : '#9aa3ad';

    context.beginPath();
    context.moveTo(source.x, source.y);
    context.lineTo(target.x, target.y);
    context.strokeStyle = color;
    const vividBoost = Math.max(0, (settings().edgeVibrance - 100) / 100) * 0.28;
    context.globalAlpha = incident ? 0.96 : view === 'semantic' ? Math.min(0.78, 0.34 + vividBoost) : 0.28;
    context.lineWidth = ((view === 'semantic' ? 0.55 + (link.strength ?? 2) * 0.16 : 0.75) / Math.sqrt(camera.k)) * 1.2 * (settings().edgeWidth / 100) * (incident ? 1.55 : 1);
    context.stroke();

    if (view === 'timeline' && !usesSemanticLayout() && incident) drawArrowHead(source, target, color);
  });
  context.globalAlpha = 1;
}

function drawArrowHead(source, target, color) {
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const radius = renderedNodeRadius(target) + 2 / camera.k;
  const x = target.x - Math.cos(angle) * radius;
  const y = target.y - Math.sin(angle) * radius;
  const size = 4 / Math.sqrt(camera.k);
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x - Math.cos(angle - 0.5) * size, y - Math.sin(angle - 0.5) * size);
  context.lineTo(x - Math.cos(angle + 0.5) * size, y - Math.sin(angle + 0.5) * size);
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function drawNodes() {
  visibleNodes().forEach((node) => {
    const selected = node === selectedNode;
    const searched = searchNodes.has(node.id);
    const multiSelected = selectedNodes.has(node.id);
    const hovered = node === hoveredNode;
    const radius = renderedNodeRadius(node);

    if (selected || searched || multiSelected) {
      context.beginPath();
      context.arc(node.x, node.y, radius + (searched ? 6 : 4) / camera.k, 0, Math.PI * 2);
      context.fillStyle = searched ? 'rgba(196,125,15,.2)' : multiSelected ? 'rgba(37,109,177,.24)' : 'rgba(28,42,61,.12)';
      context.fill();
    }

    context.save();
    if (hovered) {
      context.shadowColor = canvasIsDark() ? 'rgba(0,0,0,.88)' : 'rgba(20,27,35,.55)';
      context.shadowBlur = 12 / camera.k;
      context.shadowOffsetY = 3 / camera.k;
    }
    context.beginPath();
    context.arc(node.x, node.y, radius, 0, Math.PI * 2);
    // Category colors are independent of whether an original PDF is stored locally.
    context.fillStyle = nodeFill(node);
    context.fill();
    if (hovered) {
      context.strokeStyle = canvasIsDark() ? '#f5f7f8' : '#ffffff';
      context.lineWidth = 1.6 / camera.k;
      context.stroke();
    }
    context.restore();

    if (settings().paperLabels || selected || searched || hovered) drawNodeLabel(node, hovered);
  });
  context.globalAlpha = 1;
}

function compactAuthorLabel(authors) {
  const names = Array.isArray(authors) ? authors.map((name) => String(name || '').trim()).filter(Boolean) : [];
  if (!names.length) return panelText('作者未知', 'Unknown author');
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names[0]} et al.`;
}

function paperAuthorYearLabel(node, maxLength = 32) {
  const authors = Array.isArray(node.authors) ? node.authors.filter(Boolean) : [];
  const authorText = compactAuthorLabel(authors);
  const label = `${authorText} · ${node.year || panelText('年份未知', 'n.d.')}`;
  return label.length > maxLength ? `${label.slice(0, maxLength)}…` : label;
}

function drawNodeLabel(node, hovered = false) {
  const authors = (node.authors || []).join(', ') || panelText('作者未知', 'Unknown author');
  const shortAuthors = authors.length > 26 ? `${authors.slice(0, 26)}…` : authors;
  let title;
  if (settings().paperLabelMode === 'authors-year') title = paperAuthorYearLabel(node);
  else if (settings().paperLabelMode === 'year-authors') title = `${node.year || panelText('年份未知','n.d.')} · ${shortAuthors}`;
  else title = node.title.length > 38 ? `${node.title.slice(0, 38)}…` : node.title;
  const fontSize = (9.5 * settings().paperLabelSize / 100) / Math.sqrt(camera.k);
  context.font = `400 ${fontSize}px ${CANVAS_FONT_STACK}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const textWidth = context.measureText(title).width;
  const x = node.x;
  const y = node.y + renderedNodeRadius(node) + 5 / camera.k + fontSize / 2;
  const markerRadius = 1.25 / camera.k;
  const horizontalPadding = 5 / camera.k;
  const verticalPadding = 3.4 / camera.k;
  const rectX = x - textWidth / 2 - horizontalPadding;
  const rectY = y - fontSize / 2 - verticalPadding;
  const rectWidth = textWidth + horizontalPadding * 2;
  const rectHeight = fontSize + verticalPadding * 2;
  const markerX = rectX - markerRadius - 2.4 / camera.k;
  context.globalAlpha = 0.94;
  if (hovered) {
    context.save();
    context.shadowColor = canvasIsDark() ? 'rgba(0,0,0,.78)' : 'rgba(20,27,35,.3)';
    context.shadowBlur = 8 / camera.k;
    context.shadowOffsetY = 2 / camera.k;
    context.fillStyle = canvasIsDark() ? '#111315' : '#ffffff';
    context.beginPath();
    context.roundRect(rectX, rectY, rectWidth, rectHeight, 2.5 / camera.k);
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1.2 / camera.k;
    context.stroke();
    context.restore();
  }
  if (settings().readMarkers) {
    context.beginPath();
    context.arc(markerX, y, markerRadius, 0, Math.PI * 2);
    context.fillStyle = node.read ? (canvasIsDark() ? '#f0f2f4' : '#313941') : (canvasIsDark() ? '#1b1c1e' : '#fbfbfb');
    context.fill();
    context.strokeStyle = canvasIsDark() ? '#f0f2f4' : '#313941';
    context.lineWidth = 0.8 / camera.k;
    context.stroke();
  }
  context.fillStyle = canvasIsDark() ? '#f0f2f4' : '#222b36';
  context.fillText(title, x, y);
}

function render() {
  const deleteButton=document.querySelector('#delete-papers-button');
  if(deleteButton)deleteButton.disabled=!nodes.some(node=>selectedNodes.has(node.id)||selectedNode?.id===node.id);
  updateGraphLegend();
  if (renderMode === '3d') {
    void renderGraph3D();
    return;
  }
  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  context.drawImage(backgroundArtwork(currentBackground().id, canvas.width, canvas.height), 0, 0, width, height);
  context.save();
  context.translate(camera.x, camera.y);
  context.scale(camera.k, camera.k);
  drawYearGuides();
  drawLinks();
  drawNodes();
  drawTheoryGroupLabels();
  context.restore();
}

function updateGraphLegend() {
  const keyHint = document.querySelector('#graph-3d-keys');
  keyHint.hidden = renderMode !== '3d' || view === 'table';
  keyHint.innerHTML = `<span>${panelText('左键拖动空白：旋转','Left-drag background: rotate')}</span><span>${panelText('右键拖动：平移','Right-drag: pan')}</span><span><kbd>W</kbd><kbd>↑</kbd> ${panelText('前进', 'Forward')}</span><span><kbd>S</kbd><kbd>↓</kbd> ${panelText('后退', 'Back')}</span><span><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd> ${panelText('左右平移', 'Strafe')}</span>`;
  const palette = EDGE_PALETTES[settings().edgePalette] || EDGE_PALETTES.e0;
  const legend = document.querySelector('.graph-legend');
  if (!legend) return;
  const colors = {
    support: adjustVibrance(palette.support, settings().edgeVibrance),
    oppose: adjustVibrance(palette.oppose, settings().edgeVibrance),
    'related-strong': adjustVibrance(palette.relatedStrong, settings().edgeVibrance),
    'related-weak': adjustVibrance(palette.relatedWeak, settings().edgeVibrance)
  };
  const relationLegend = `<span><i class="legend-line support" style="background:${colors.support}"></i><b>${t('support')}</b></span><span><i class="legend-line oppose" style="background:${colors.oppose}"></i><b>${t('oppose')}</b></span><span><i class="legend-line related-strong" style="background:${colors['related-strong']}"></i><b>${panelText('强相关', 'Strongly related')}</b></span><span><i class="legend-line related-weak" style="background:${colors['related-weak']}"></i><b>${panelText('弱相关', 'Weakly related')}</b></span>`;
  const citationLegend = `<span><i class="legend-line citation"></i><b>${panelText('引用方向', 'Citation direction')}</b></span>`;
  const vectorLegend = `<span><i class="legend-line related-strong" style="background:${colors['related-strong']}"></i><b>${panelText('高语义相似', 'High semantic similarity')}</b></span><span><i class="legend-line related-weak" style="background:${colors['related-weak']}"></i><b>${panelText('低语义相似', 'Low semantic similarity')}</b></span>`;
  const edgeLegend = usesSemanticLayout() ? vectorLegend : view === 'timeline' && settings().relationLayer !== 'argument' ? citationLegend : relationLegend;
  legend.innerHTML = `${edgeLegend}<span class="legend-separator"></span><span><i class="size-sample small"></i><i class="size-sample large"></i>${panelText('节点大小＝被引量', 'Node size = citations')}</span><span><i class="depth-sample"></i>${panelText('颜色深浅＝与主要理论的关联强度', 'Color depth = affinity with primary theory')}</span>`;
}

function graph3dDataset() {
  const visible = visibleNodes();
  const ids = new Set(visible.map((node) => node.id));
  const spread = view === 'timeline' ? Math.max(0.25, (settings().cohortSpread || 430) / 430) : 1;
  const graphNodes = visible.map((node, index) => ({
    ...node,
    x: view === 'timeline' ? Number(node.x || 0) * spread : node.x,
    z: view === 'timeline' ? ((((index * 47) % 101) / 100) - 0.5) * 360 * spread : node.z,
    val: settings().nodeSize <= 0 ? 0 : Math.max(1, Math.pow(nodeRadius(node) / 4.2, 2.4))
  }));
  const displayedLinks = currentMasterLinks().filter((link) => {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    return ids.has(source) && ids.has(target) && (usesSemanticLayout() || view === 'timeline' || enabledRelations.has(link.relation));
  }).map((link) => ({
    ...link,
    source: endpointId(link.source),
    target: endpointId(link.target),
    displayOnly: !usesSemanticLayout() && view === 'timeline' && settings().relationLayer === 'citation'
  }));

  let graphLinks = displayedLinks;
  if (!usesSemanticLayout() && view === 'timeline' && settings().relationLayer === 'citation') {
    const displayedPairs = new Set(displayedLinks.map((link) => [endpointId(link.source), endpointId(link.target)].sort().join('|')));
    const layoutOnlyLinks = currentLayoutLinks()
      .filter((link) => {
        const source = endpointId(link.source);
        const target = endpointId(link.target);
        return ids.has(source) && ids.has(target) && enabledRelations.has(link.relation)
          && !displayedPairs.has([source, target].sort().join('|'));
      })
      .map((link) => ({
        ...link,
        id: `layout-${link.id}`,
        source: endpointId(link.source),
        target: endpointId(link.target),
        layoutOnly: true
      }));
    graphLinks = [...displayedLinks, ...layoutOnlyLinks];
  }
  return { nodes: graphNodes, links: graphLinks };
}

function yearGuideHalfSize(data) {
  const spreadScale = Math.max(0.25, (settings().cohortSpread || 430) / 430);
  const extents = data.nodes.flatMap((node) => [Math.abs(Number(node.x) || 0), Math.abs(Number(node.z) || 0)]);
  return Math.max(330, ...extents, 290 + spreadScale * 150) + 64;
}

function current3dCameraSlot() {
  return graph3dCameraStates[view]?.[layoutBasis] || null;
}

let pendingInitial3dFit = null;
function fitInitial3dModel() {
  if(!pendingInitial3dFit || renderMode!=='3d' || pendingInitial3dFit.slot!==`${currentProjectId}:${view}:${layoutBasis}`)return;
  const camera=graph3d.camera();
  const fit=framePerspectiveModel(initialFramingPoints(graph3d.graphData().nodes),camera,graph3dThree);
  if(!fit)return;
  graph3d.cameraPosition(fit.position,fit.target,0);
  save3dCameraState();
}
function cancelInitial3dFit() { pendingInitial3dFit=null; }
graph3dHost.addEventListener('pointerdown',cancelInitial3dFit,true);
graph3dHost.addEventListener('wheel',cancelInitial3dFit,{capture:true,passive:true});
graph3dHost.addEventListener('keydown',event=>{if(navigationKeys.has(event.code))cancelInitial3dFit();},true);

function save3dCameraState() {
  if (!graph3d || !graph3dCameraStates[view]) return;
  const position = graph3d.cameraPosition();
  const target = graph3d.controls?.().target;
  if (!position || !target) return;
  graph3dCameraStates[view][layoutBasis] = {
    position: { x: position.x, y: position.y, z: position.z },
    target: { x: target.x, y: target.y, z: target.z }
  };
}

function restore3dCameraState(duration = 0) {
  const saved = current3dCameraSlot();
  if (!graph3d || !saved) return false;
  graph3d.cameraPosition(saved.position, saved.target, duration);
  return true;
}

function positionTimelineCamera(data, duration = 0) {
  if (!graph3d || !data.nodes.length) return;
  const yValues = data.nodes.map((node) => Number(node.fy ?? node.y)).filter(Number.isFinite).sort((a, b) => a - b);
  const focusedValues = yValues.length > 10 ? yValues.slice(1) : yValues;
  const minY = Math.min(...focusedValues);
  const maxY = Math.max(...focusedValues);
  const centerY = (minY + maxY) / 2;
  const timeSpan = Math.max(160, maxY - minY);
  const halfSize = yearGuideHalfSize(data);
  const distance = Math.max(310, halfSize * 0.68, timeSpan * 0.32);
  const position = { x: halfSize * 0.1, y: maxY + Math.max(105, timeSpan * 0.18), z: distance };
  const target = { x: 0, y: centerY - timeSpan * 0.04, z: 0 };
  graph3d.cameraPosition(position, target, duration);
  graph3dCameraStates.timeline[layoutBasis] = { position, target };
}

function fitGraph3D(duration = 0, firstEntry = false) {
  if (!graph3d) return;
  cancelInitial3dFit();
  const data = graph3d.graphData();
  if (view === 'timeline') {
    positionTimelineCamera(data, duration);
    if (firstEntry && usesSemanticLayout()) moveInitialSemanticCameraCloser();
    return;
  }
  const root=graph3d.scene().children.find(child=>typeof child.graphData==='function');
  const points=data.nodes.map(n=>{
    const point=new graph3dThree.Vector3(n.x,n.y,n.z);
    return root ? root.localToWorld(point) : point;
  });
  const fit=framePerspectiveModel(points,graph3d.camera(),graph3dThree);
  if(fit)graph3d.cameraPosition(fit.position,fit.target,duration);
  window.setTimeout(save3dCameraState, Math.max(0, duration) + 40);
}

function moveInitialSemanticCameraCloser() {
  const target = graph3d.controls().target;
  graph3d.cameraPosition(closerCamera(graph3d.cameraPosition(), target), { x: target.x, y: target.y, z: target.z }, 0);
  save3dCameraState();
}

function syncGraphBackground() {
  if (!graph3d || !graph3dThree) return;
  const rect = graph3dHost.getBoundingClientRect();
  const w = Math.round(rect.width * (window.devicePixelRatio || 1));
  const h = Math.round(rect.height * (window.devicePixelRatio || 1));
  const key = `${currentBackground().id}:${w}:${h}`;
  if (key !== graphBackgroundKey) {
    graphBackgroundTexture?.dispose();
    graphBackgroundTexture = new graph3dThree.CanvasTexture(backgroundArtwork(currentBackground().id, w, h));
    graphBackgroundTexture.colorSpace = graph3dThree.SRGBColorSpace;
    graphBackgroundKey = key;
  }
  graph3d.scene().background = graphBackgroundTexture;
}

function disposeThreeObject(object) {
  object?.traverse?.((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => { material?.map?.dispose?.(); material?.dispose?.(); });
  });
}

function updateGraph3dYearGuides(THREE, SpriteText, data) {
  const scene = graph3d?.scene?.();
  if (!scene) return;
  if (graph3dYearGuideGroup) {
    scene.remove(graph3dYearGuideGroup);
    disposeThreeObject(graph3dYearGuideGroup);
    graph3dYearGuideGroup = null;
  }
  if (view !== 'timeline' || !settings().showYearAxis) return;
  const years = [...new Set(nodes.filter(n=>!n.importCanvasHidden&&n.year).map((node) => Number(node.year)).filter(Number.isFinite))].sort((a, b) => a - b);
  if (!years.length) return;
  const halfSize = yearGuideHalfSize(data);
  const group = new THREE.Group();
  group.name = 'litgraph-year-guides';
  years.forEach((year) => {
    const y = yearPosition(year);
    const points = [
      new THREE.Vector3(-halfSize, y, -halfSize), new THREE.Vector3(halfSize, y, -halfSize),
      new THREE.Vector3(halfSize, y, -halfSize), new THREE.Vector3(halfSize, y, halfSize),
      new THREE.Vector3(halfSize, y, halfSize), new THREE.Vector3(-halfSize, y, halfSize),
      new THREE.Vector3(-halfSize, y, halfSize), new THREE.Vector3(-halfSize, y, -halfSize)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: canvasIsDark() ? 0x5f6872 : 0xb6bdc5,
      transparent: true,
      opacity: canvasIsDark() ? 0.34 : 0.46,
      dashSize: 12,
      gapSize: 9
    });
    const planeOutline = new THREE.LineSegments(geometry, material);
    planeOutline.computeLineDistances();
    group.add(planeOutline);
    const label = new SpriteText(String(year));
    label.fontFace = 'system-ui';
    label.fontSize = 144;
    label.raycast = () => {};
    label.color = canvasIsDark() ? '#c4c9cf' : '#68717b';
    label.textHeight = 12;
    label.position.set(-halfSize + 18, y + 4, halfSize + 5);
    label.material.depthWrite = false;
    group.add(label);
  });
  graph3dYearGuideGroup = group;
  scene.add(group);
}

function applyGraph3dFocusState() {
  if (!graph3d) return;
  const data = graph3d.graphData();
  data.links.forEach((link) => {
    const visible = !link.layoutOnly
      && settings().edgeWidth > 0
      && linkMatchesSelection(link, selectedNode);
    if (link.__lineObj) link.__lineObj.visible = visible;
    if (link.__arrowObj) link.__arrowObj.visible = visible;
    if (link.__photonsObj) link.__photonsObj.visible = visible;
  });
}

async function renderGraph3D(forceData = false) {
  if (renderMode !== '3d' || view === 'table') return;
  const status = document.querySelector('#graph-3d-status');
  if (!graph3d) status.hidden = false;
  try {
    graph3dModulePromise ??= import('3d-force-graph');
    graph3dLabelModulePromise ??= import('three-spritetext');
    graph3dThreeModulePromise ??= import('three');
    const [{ default: ForceGraph3D }, { default: SpriteText }, THREE] = await Promise.all([graph3dModulePromise, graph3dLabelModulePromise, graph3dThreeModulePromise]);
    graph3dThree = THREE;
    if (renderMode !== '3d' || view === 'table') return;
    if (!graph3d) {
      graph3d = new ForceGraph3D(graph3dHost, { controlType: 'orbit', rendererConfig: { antialias: true, alpha: false } })
      .showNavInfo(false)
      .warmupTicks(60)
      .cooldownTicks(180)
      .nodeLabel(() => '')
      .nodeColor(nodeFill)
      .nodeVal('val')
      .nodeRelSize(3.3)
      .nodeOpacity(0.94)
      .nodeResolution(20)
      .nodeThreeObjectExtend(true)
      .linkColor((link) => usesSemanticLayout() || view === 'semantic' || settings().relationLayer === 'argument' ? edgeColor(link) : '#7f7f7f')
      .linkWidth((link) => Math.max(0, (0.32 + (link.strength ?? 2) * 0.14) * settings().edgeWidth / 100))
      .linkVisibility((link) => {
        if (link.layoutOnly) return false;
        if (settings().edgeWidth <= 0) return false;
        return linkMatchesSelection(link, selectedNode);
      })
      .linkOpacity(0.48)
      .onNodeHover((node) => {
        const nextHover = node ? nodes.find((item) => item.id === node.id) || null : null;
        if (nextHover === hoveredNode) return;
        hoveredNode = nextHover;
        graph3dHost.style.cursor = nextHover ? 'pointer' : 'grab';
        showTooltip(nextHover, graph3dPointer);
      })
      .onNodeClick((node) => {
        const original = nodes.find((item) => item.id === node.id);
        if (!original) return;
        recordUse('explore');
        if (interactionMode === 'multi') {
          if (selectedNodes.has(original.id)) selectedNodes.delete(original.id);
          else selectedNodes.add(original.id);
          updateResearchEntry();
          graph3d.refresh();
          return;
        }
        original.read = true;
        selectedNodes.clear();
        selectedNode = selectedNode?.id === original.id && inspector.classList.contains('open') ? null : original;
        if (selectedNode) renderInspector(selectedNode); else renderOverview();
        updateResearchEntry();
        applyGraph3dFocusState();
      })
        .onEngineTick(() => {
          status.hidden = true;
          if(pendingInitial3dFit && ++pendingInitial3dFit.ticks % 10 === 1)fitInitial3dModel();
        })
        .onEngineStop(() => { status.hidden = true; fitInitial3dModel(); pendingInitial3dFit=null; });
      graph3d.controls?.().addEventListener('change', save3dCameraState);
      modelRotation = mountModelRotation(graph3d, THREE, graph3dHost, {
        mode: () => view === 'timeline' ? 'timeline' : 'model',
        slot: () => `${currentProjectId}:${view}:${layoutBasis}`,
        guides: () => graph3dYearGuideGroup,
        enabled: () => renderMode === '3d' && view !== 'table' && !interactionMode,
        onStart: () => { hoveredNode = null; tooltip.classList.remove('show'); },
        onEnd: save3dCameraState
      });
    }
    graph3d.resumeAnimation();
    const data = graph3dDataset();
    const nextKey = `${view}:${layoutBasis}:${settings().relationLayer}:${data.nodes.map((node) => node.id).join(',')}:${data.links.map((link) => link.id).join(',')}`;
    graph3d
    .width(graph3dHost.getBoundingClientRect().width)
    .height(graph3dHost.getBoundingClientRect().height)
    .backgroundColor(currentBackground().color)
    .nodeColor(nodeFill)
    .nodeThreeObject((node) => {
      if (!settings().paperLabels) return null;
      const label = new SpriteText(paperAuthorYearLabel(node, 36));
      label.name = 'litgraph-paper-label';
      label.fontFace = 'system-ui';
      label.fontSize = 144;
      label.fontWeight = 500;
      label.raycast = () => {};
      label.color = canvasIsDark() ? '#f1f3f5' : '#20272f';
      label.textHeight = Math.max(8.5, 10.5 * settings().paperLabelSize / 100);
      label.backgroundColor = false;
      label.padding = 0;
      label.borderRadius = 1.5;
      const sphereRadius = 3.3 * Math.cbrt(Math.max(0.001, node.val || 0.001));
      label.center.set(0.5, 1);
      label.position.y = -(sphereRadius + label.textHeight * 0.78 + 2.4);
      label.material.depthWrite = false;
      return label;
    })
    .linkColor((link) => usesSemanticLayout() || view === 'semantic' || settings().relationLayer === 'argument' ? edgeColor(link) : '#7f7f7f')
    .linkWidth((link) => Math.max(0, (0.32 + (link.strength ?? 2) * 0.14) * settings().edgeWidth / 100))
    .linkVisibility((link) => {
      if (link.layoutOnly) return false;
      if (settings().edgeWidth <= 0) return false;
      return linkMatchesSelection(link, selectedNode);
    });
    syncGraph3dResolution();
    syncGraphBackground();
    if (forceData || nextKey !== graph3dDataKey) {
      graph3dDataKey = nextKey;
      const spreadForce = view === 'timeline' ? Math.max(0.6, (settings().cohortSpread || 430) / 430) : 1;
      graph3d.d3Force('charge')?.strength(-Math.max(40, settings().charge) * spreadForce);
      graph3d.d3Force('link')?.distance(linkDistance).strength(linkStrength);
      data.nodes.forEach((node) => {
        if (view === 'timeline') node.fy = yearPosition(publicationValue(node));
      });
      const initialized = graph3dInitialized[view][layoutBasis];
      const framingSlot=`${currentProjectId}:${view}:${layoutBasis}`;
      if(!initialized && view==='semantic')pendingInitial3dFit={slot:framingSlot,ticks:0};
      else if(pendingInitial3dFit?.slot!==framingSlot)pendingInitial3dFit=null;
      graph3d.graphData(data);
      updateGraph3dYearGuides(THREE, SpriteText, data);
      window.requestAnimationFrame(applyGraph3dFocusState);
      if (!initialized) {
        graph3dInitialized[view][layoutBasis] = true;
        const initialSlot = `${view}:${layoutBasis}`;
        window.setTimeout(() => {
          if (renderMode === '3d' && `${view}:${layoutBasis}` === initialSlot) {
            if(view==='semantic')fitInitial3dModel();
            else fitGraph3D(0, true);
          }
        }, 120);
      } else {
        restore3dCameraState(0);
      }
    } else {
      const spreadForce = view === 'timeline' ? Math.max(0.6, (settings().cohortSpread || 430) / 430) : 1;
      graph3d.d3Force('charge')?.strength(-Math.max(40, settings().charge) * spreadForce);
      graph3d.d3Force('link')?.distance(linkDistance).strength(linkStrength);
      updateGraph3dYearGuides(THREE, SpriteText, data);
      graph3d.refresh();
      window.requestAnimationFrame(applyGraph3dFocusState);
    }
    modelRotation?.sync();
  } catch (error) {
    status.hidden = false;
    status.classList.add('error');
    status.querySelector('span').textContent = panelText(`三维图谱加载失败：${error.message}`, `3D graph failed to load: ${error.message}`);
  }
}

function setRenderMode(mode) {
  const nextMode = ['2d', '3d'].includes(mode) ? mode : '2d';
  if (nextMode === renderMode) return;
  clearCurrentNodeSelection();
  if (renderMode === '3d') save3dCameraState();
  else if (usesSemanticLayout()) saveVectorState(view);
  else saveGraphState(view);
  renderMode = nextMode;
  viewRenderModes[view] = nextMode;
  updateGraphLegend();
  canvas.hidden = renderMode === '3d';
  graph3dHost.hidden = renderMode !== '3d';
  if (renderMode === '3d') {
    simulation.stop();
    graph3dDataKey = '';
    const status = document.querySelector('#graph-3d-status');
    status.classList.remove('error');
    status.querySelector('span').textContent = panelText('正在构建三维图谱…', 'Building 3D graph…');
    status.hidden = false;
    void renderGraph3D(true);
  } else {
    graph3d?.pauseAnimation();
    hoveredNode = null;
    tooltip.classList.remove('show');
    if (usesSemanticLayout()) {
      buildVectorLinks();
      loadVectorPositions(view);
    } else {
      loadGraphState(view);
    }
    configureSimulation(true);
    if (usesSemanticLayout() && !vectorCameras[view]) {
      settleSemantic2DLayout();
      fitView(0);
      saveVectorState(view);
    }
    render();
  }
  if (renderMode !== '3d') document.querySelector('#graph-3d-status').hidden = true;
  renderSecondaryPanel();
  updateGraphLegend();
}

function setLayoutBasis(basis) {
  const nextBasis = basis === 'semantic' ? 'semantic' : 'argument';
  if (nextBasis === layoutBasis) return;
  clearCurrentNodeSelection();
  if (renderMode === '3d') save3dCameraState();
  else if (usesSemanticLayout()) saveVectorState(view);
  else saveGraphState(view);
  layoutBasis = nextBasis;
  viewLayoutBases[view] = nextBasis;
  if (usesSemanticLayout()) {
    buildVectorLinks();
    loadVectorPositions(view);
  } else {
    loadGraphState(view);
  }
  updateGraphLegend();
  if (renderMode === '3d') {
    simulation.stop();
    graph3dDataKey = '';
    void renderGraph3D(true);
  } else {
    configureSimulation(true);
    const savedCamera = usesSemanticLayout() ? vectorCameras[view] : viewCameras[view];
    if (!savedCamera) {
      settleSemantic2DLayout();
      fitView(0);
    }
  }
  renderSecondaryPanel();
  render();
}

function screenToWorld(x, y) {
  return { x: (x - camera.x) / camera.k, y: (y - camera.y) / camera.k };
}

function findNode(screenX, screenY) {
  const point = screenToWorld(screenX, screenY);
  let best = null;
  let bestDistance = Infinity;
  visibleNodes().forEach((node) => {
    const threshold = Math.max(renderedNodeRadius(node) + 4 / camera.k, 10 / camera.k);
    const dx = node.x - point.x;
    const dy = node.y - point.y;
    const distance = dx * dx + dy * dy;
    if (distance <= threshold * threshold && distance <= bestDistance) {
      best = node;
      bestDistance = distance;
    }
  });
  return best;
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.clientWidth / Math.max(1, rect.width)),
    y: (event.clientY - rect.top) * (canvas.clientHeight / Math.max(1, rect.height))
  };
}

function fitView(duration = 0) {
  if (renderMode === '3d') {
    fitGraph3D(duration || 0);
    return;
  }
  const visible = visibleNodes();
  if (!visible.length) return;
  if (usesSemanticLayout() && view === 'semantic') {
    const matched = match2dFraming(visible, theory2dFraming[view], width, height);
    if (matched) {
      camera = matched;
      render();
      return;
    }
  }
  const minX = Math.min(...visible.map((node) => node.x));
  const maxX = Math.max(...visible.map((node) => node.x));
  const sortedY = visible.map((node) => node.y).sort((a, b) => a - b);
  const focusedY = view === 'timeline' && sortedY.length > 10 ? sortedY.slice(1) : sortedY;
  const minY = Math.min(...focusedY);
  const maxY = Math.max(...focusedY);
  const leftInset = 28;
  const rightInset = inspector.classList.contains('open') && width > 720 ? inspectorWidth + 18 : 28;
  const availableWidth = Math.max(280, width - leftInset - rightInset);
  const availableHeight = Math.max(260, height - 90);
  const minimumZoom = view === 'timeline' ? 0.07 : usesSemanticLayout() ? 0.06 : 0.22;
  const fittedZoom = Math.min(2.2, availableWidth / Math.max(220, maxX - minX + 100), availableHeight / Math.max(220, maxY - minY + 100));
  const viewMagnification = view === 'timeline' ? 1.08 : 1;
  const nextK = Math.max(minimumZoom, Math.min(2.2, fittedZoom * viewMagnification));
  const next = {
    k: nextK,
    x: leftInset + availableWidth / 2 - ((minX + maxX) / 2) * nextK,
    y: 45 + availableHeight / 2 - ((minY + maxY) / 2) * nextK
  };
  if (!duration) {
    camera = next;
    render();
    return;
  }
  const start = { ...camera };
  const started = performance.now();
  const animate = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    camera = {
      x: start.x + (next.x - start.x) * eased,
      y: start.y + (next.y - start.y) * eased,
      k: start.k + (next.k - start.k) * eased
    };
    render();
    if (progress < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

function centerNode(node) {
  const target = { x: width * 0.52 - node.x * 2.1, y: height * 0.5 - node.y * 2.1, k: 2.1 };
  const start = { ...camera };
  const started = performance.now();
  const animate = (now) => {
    const progress = Math.min(1, (now - started) / 360);
    const eased = 1 - Math.pow(1 - progress, 3);
    camera = {
      x: start.x + (target.x - start.x) * eased,
      y: start.y + (target.y - start.y) * eased,
      k: start.k + (target.k - start.k) * eased
    };
    render();
    if (progress < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

function updateCounters() {
  const visible = visibleNodes();
  document.querySelector('#node-count').textContent = String(visible.length);
  document.querySelector('#edge-count').textContent = String(activeLinks.length);
  document.querySelector('#fulltext-count').textContent = String(visible.filter((node) => node.hasPdf).length);
  const projectName = document.querySelector('#project-selector-current-name');
  const projectCount = document.querySelector('#project-selector-current-count');
  if (projectName) projectName.textContent = project.meta.title || panelText('当前研究项目', 'Current project');
  if (projectCount) projectCount.textContent = `${visible.length} ${panelText('篇', 'papers')}`;
  updateResearchEntry();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderOverview() {
  inspector.classList.remove('open');
  inspector.setAttribute('aria-hidden', 'true');
  document.querySelector('#project-title').textContent = project.meta.title;
  document.querySelector('#project-selector-label').textContent = project.meta.title;
  inspector.innerHTML = `
    <div class="inspector-empty">
      <span class="inspector-kicker">${panelText('交互工作台', 'Interactive workspace')}</span>
      <h2>${escapeHtml(project.meta.title)}</h2>
      <p>${panelText('圆点代表论文，颜色表示主要理论。', 'Nodes represent papers; colors indicate their primary theory.')}</p>
      <div class="overview-visual">
        <svg width="145" height="90" viewBox="0 0 145 90" aria-hidden="true">
          <g stroke="#c9ced5" stroke-width="1" opacity=".65"><path d="M23 46 57 27 86 43 117 19M57 27 66 68M86 43 105 71M66 68 105 71M86 43 117 66"/></g>
          <g>${project.theories.slice(0,8).map((theory, index) => `<circle cx="${[23,57,86,117,66,105,117,41][index]}" cy="${[46,27,43,19,68,71,66,75][index]}" r="5" fill="${theory.color}" stroke="white" stroke-width="1.5"/>`).join('')}</g>
        </svg>
      </div>
      <ul class="hint-list">
        <li>${panelText('悬停节点：查看论文信息', 'Hover over a node for paper information')}</li>
        <li>${panelText('点击节点：查看详情与相邻连线', 'Click a node for details and connected edges')}</li>
        <li>${panelText('拖拽节点：调整位置', 'Drag nodes to reposition them')}</li>
        <li>${panelText('年份视图：纵向位置固定为发表年份', 'Timeline: vertical position follows publication year')}</li>
      </ul>
    </div>`;
}

function closeInspectorPanel() {
  selectedNode = null;
  hoveredNode = null;
  tooltip.classList.remove('show');
  renderOverview();
  render();
  applyGraph3dFocusState();
  graph3d?.refresh();
  updateResearchEntry();
}

function paperSource(node) {
  const isWebAddress = (value) => /^https?:\/\//i.test(String(value || ''));
  const isValidDoi = (value) => /^10\.\d{4,9}\/\S+$/i.test(String(value || '').trim());
  if (isWebAddress(node.pdfUrl)) return node.pdfUrl;
  if (isWebAddress(node.sourceUrl)) return node.sourceUrl;
  if (isValidDoi(node.doi)) return `https://doi.org/${node.doi}`;
  if (isWebAddress(node.url)) return node.url;
  return node.localFileUrl || node.url || '';
}

async function openPaper(node) {
  try {
    if (node.sampleMarkdown && !node.hasPdf && !node.originalRelativePath) {
      toast(panelText('样例包含 MD 原文，可直接提问；未附带 PDF 文件。', 'The sample includes Markdown for questions, but no PDF file.'));
      return;
    }
    if (!node.fulltextKey && node.fulltextStorageKey) {
      const document = await getFulltext(node);
      if (document) { await saveFulltext(currentProjectId, node, document); saveCurrentProject(); }
    }
    if (node.fulltextKey && desktop) {
      await localRequest('open-native', { key: node.fulltextKey });
      return;
    }
    const original = await originalBlob(node);
    if (original) {
      const url = URL.createObjectURL(original);
      const a = document.createElement('a'); a.href = url;
      a.download = node.fileName || (node.title.replace(/[<>:"/\\|?*]/g, '_') + (original.type.includes('pdf') ? '.pdf' : '.md'));
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast(panelText('原文已下载，请用系统中的应用打开。', 'Original downloaded. Open it with a system application.'));
      return;
    }
    const source = paperSource(node);
    if (/^https?:/i.test(source)) window.open(source, '_blank', 'noopener,noreferrer');
    else toast(panelText('原文件不可用，请补充论文原文。', 'Original unavailable. Please add the paper file.'));
  } catch (error) { toast(localizedError(error, language)); }
}

function citationText(node, style) {
  const authors = (node.authors || []).join(', ');
  const title = node.title || '';
  const journal = [node.journal, node.volume ? `${node.volume}${node.issue ? `(${node.issue})` : ''}` : node.issue, node.pages].filter(Boolean).join(', ');
  const doi = node.doi ? `https://doi.org/${node.doi}` : (node.url || '');
  if (style === 'gbt') return `${authors}. ${title}[J]. ${journal}, ${node.year}. ${doi}`;
  if (style === 'mla') return `${authors}. “${title}.” ${journal}, ${node.year}. ${doi}`;
  if (style === 'chicago') return `${authors}. “${title}.” ${journal} (${node.year}). ${doi}`;
  if (style === 'harvard') return `${authors} (${node.year}) '${title}', ${journal}. Available at: ${doi}.`;
  return `${authors} (${node.year}). ${title}. ${journal}. ${doi}`;
}

function openSummaryWindow(node) {
  summaryWindowIndex += 1;
  const id = `summary-window-${summaryWindowIndex}`;
  const element = document.createElement('article');
  element.className = 'summary-window';
  element.id = id;
  element.style.left = `${36 + (summaryWindowIndex % 5) * 34}px`;
  element.style.top = `${34 + (summaryWindowIndex % 4) * 28}px`;
  element.innerHTML = `<header class="summary-window-header"><div><strong>${escapeHtml(node.title)}</strong><span>AI summary · local document</span></div><div><button type="button" data-highlight title="${panelText('黄色高亮选中文字', 'Highlight selected text')}">▰</button><button type="button" data-close aria-label="${panelText('关闭文档', 'Close document')}">×</button></div></header><div class="summary-editor" contenteditable="true" spellcheck="true"><h3>${panelText('核心结论', 'Core conclusion')}</h3><p>${escapeHtml(node.summary)}</p><h3>${panelText('研究问题', 'Research question')}</h3><p>${escapeHtml(node.detailedResults?.question || '—')}</p><h3>${panelText('方法', 'Method')}</h3><p>${escapeHtml(node.detailedResults?.method || '—')}</p><h3>${panelText('详细结果', 'Detailed results')}</h3><ul>${(node.detailedResults?.metrics || []).map((metric) => `<li>${escapeHtml(metric)}</li>`).join('')}</ul></div>`;
  floatingWindowLayer.appendChild(element);
  element.querySelector('[data-close]').addEventListener('click', () => element.remove());
  element.querySelector('[data-highlight]').addEventListener('click', () => document.execCommand('hiliteColor', false, '#fff19b'));
  const editor = element.querySelector('.summary-editor');
  editor.addEventListener('input', () => localStorage.setItem(`litgraph.summary.${node.id}`, editor.innerHTML));
  const saved = localStorage.getItem(`litgraph.summary.${node.id}`);
  if (saved) editor.innerHTML = saved;
  const header = element.querySelector('.summary-window-header');
  let drag = null;
  header.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    drag = { x: event.clientX, y: event.clientY, left: element.offsetLeft, top: element.offsetTop };
    header.setPointerCapture(event.pointerId);
  });
  header.addEventListener('pointermove', (event) => {
    if (!drag) return;
    element.style.left = `${Math.max(0, drag.left + (event.clientX - drag.x) / PAGE_SCALE)}px`;
    element.style.top = `${Math.max(0, drag.top + (event.clientY - drag.y) / PAGE_SCALE)}px`;
  });
  header.addEventListener('pointerup', () => { drag = null; });
}

function openDeepReadWindowLegacy(node = null) {
  summaryWindowIndex += 1;
  const element = document.createElement('article');
  element.className = 'summary-window deep-read-window';
  element.style.left = `${70 + (summaryWindowIndex % 4) * 28}px`;
  element.style.top = `${45 + (summaryWindowIndex % 3) * 24}px`;
  const selectedScopeNodes = () => {
    const scope = element.querySelector('#research-scope')?.value || (node ? 'paper' : selectedNodes.size ? 'selected' : 'project');
    if (scope === 'paper' && node) return [node];
    if (scope === 'selected' && selectedNodes.size) return nodes.filter((item) => selectedNodes.has(item.id));
    return visibleNodes();
  };
  const scopeKey = () => {
    const scope = element.querySelector('#research-scope')?.value || (node ? 'paper' : 'project');
    if (scope === 'paper' && node) return `paper.${node.id}`;
    if (scope === 'selected') return `selection.${[...selectedNodes].sort().join('.') || 'empty'}`;
    return `project.${String(project.meta?.title || 'default').replace(/\W+/g, '-').slice(0, 48)}`;
  };
  const chatKey = () => `litgraph.chat.${scopeKey()}`;
  const renderHistory = () => {
    const records = JSON.parse(localStorage.getItem(chatKey()) || '[]');
    const host = element.querySelector('.deep-read-history');
    host.innerHTML = records.length ? records.map((message) => `<div class="chat-message ${message.role}"><b>${message.role === 'user' ? panelText('你', 'You') : 'AI'}</b>${message.role==='assistant'&&(!message.status||message.status==='done')?`<div class="message-markdown">${messageMarkdown(message.text)}</div>`:`<p>${escapeHtml(message.text)}</p>`}</div>`).join('') : `<p class="chat-empty">${panelText('针对研究问题、论证链、方法局限或结果含义提出问题。', 'Ask about the research question, argument chain, limitations, or implications.')}</p>`;
    host.scrollTop = host.scrollHeight;
  };
  const initialScope = node ? 'paper' : selectedNodes.size ? 'selected' : 'project';
  element.innerHTML = `<header class="summary-window-header"><div><strong>${panelText('AI 研究台', 'AI research desk')}</strong><span>${panelText('单篇精读、多篇比较与项目综合使用同一个工作区', 'One workspace for close reading, comparison, and project synthesis')}</span></div><div><button type="button" data-collapse aria-label="${panelText('折叠窗口', 'Collapse window')}">—</button><button type="button" data-close aria-label="${panelText('关闭窗口', 'Close window')}">×</button></div></header><div class="deep-read-body"><div class="research-scope-row"><label for="research-scope">${panelText('回答范围', 'Answer scope')}</label><select id="research-scope"><option value="paper" ${initialScope === 'paper' ? 'selected' : ''} ${node ? '' : 'disabled'}>${panelText('当前论文', 'Current paper')}</option><option value="selected" ${initialScope === 'selected' ? 'selected' : ''} ${selectedNodes.size ? '' : 'disabled'}>${panelText(`已选论文（${selectedNodes.size}）`, `Selected papers (${selectedNodes.size})`)}</option><option value="project" ${initialScope === 'project' ? 'selected' : ''}>${panelText(`当前项目（${visibleNodes().length}）`, `Current project (${visibleNodes().length})`)}</option></select></div><div class="deep-reading-mode"><b>${panelText('证据约束推理', 'Evidence-grounded reasoning')}</b><span>${panelText('回答应区分原文事实、跨论文比较和 AI 综合推断，并指出证据不足。', 'Answers distinguish source facts, cross-paper comparisons, and AI synthesis, and flag missing evidence.')}</span></div><div class="deep-read-history"></div><form class="deep-read-form"><label for="deep-input-${summaryWindowIndex}">${panelText('向文献库提问', 'Ask the literature')}</label><textarea id="deep-input-${summaryWindowIndex}" rows="3" name="research-question" autocomplete="off" placeholder="${panelText('例如：这些研究为何对抑制控制是否受观察影响得出不同结论？', 'For example: Why do these studies disagree about observation and inhibitory control?')}"></textarea><button type="submit">${panelText('开始分析', 'Analyze')}</button></form></div>`;
  floatingWindowLayer.appendChild(element);
  renderHistory();
  element.querySelector('#research-scope').addEventListener('change', renderHistory);
  element.querySelector('[data-close]').addEventListener('click', () => element.remove());
  element.querySelector('[data-collapse]').addEventListener('click', (event) => {
    element.classList.toggle('collapsed');
    event.currentTarget.textContent = element.classList.contains('collapsed') ? '□' : '—';
  });
  const header = element.querySelector('.summary-window-header');
  let drag = null;
  header.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    drag = { x: event.clientX, y: event.clientY, left: element.offsetLeft, top: element.offsetTop };
    header.setPointerCapture(event.pointerId);
  });
  header.addEventListener('pointermove', (event) => {
    if (!drag) return;
    element.style.left = `${Math.max(0, drag.left + (event.clientX - drag.x) / PAGE_SCALE)}px`;
    element.style.top = `${Math.max(0, drag.top + (event.clientY - drag.y) / PAGE_SCALE)}px`;
  });
  header.addEventListener('pointerup', () => { drag = null; });
  element.querySelector('.deep-read-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = element.querySelector('textarea');
    const question = input.value.trim();
    if (!question) return;
    const records = JSON.parse(localStorage.getItem(chatKey()) || '[]');
    records.push({ role: 'user', text: question });
    localStorage.setItem(chatKey(), JSON.stringify(records));
    input.value = '';
    renderHistory();
    const submit = element.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = panelText('正在思考…', 'Thinking…');
    try {
      const corpus = selectedScopeNodes().map((item, index) => `Document ${index + 1}\nTitle: ${item.title}\nAuthors: ${(item.authors || []).join(', ')}\nYear: ${item.year}\nAbstract: ${item.abstract || ''}\nAI summary: ${item.aiSummaryZh || item.summary || ''}`).join('\n\n---\n\n');
      const answer = await callAI([
        { role: 'system', content: 'Act as a rigorous academic synthesis assistant. Ground every claim in the supplied documents. Separate direct source facts, cross-document comparisons, and AI inference. Cite document titles in the answer and clearly state when evidence is missing or incomparable.' },
        { role: 'user', content: `${corpus}\n\nResearch question: ${question}` }
      ], aiConfig, 1200);
      records.push({ role: 'assistant', text: answer });
    } catch (error) {
      records.push({ role: 'assistant', text: panelText(`无法完成分析：${error.message}。请先在 LitGraph 菜单中检查 AI API 接口。`, `Analysis failed: ${error.message}. Check the AI API connection in the LitGraph menu.`) });
    }
    localStorage.setItem(chatKey(), JSON.stringify(records));
    submit.disabled = false;
    submit.textContent = panelText('开始分析', 'Analyze');
    renderHistory();
  });
}

function projectResearchTab() {
  return {
    id: 'project',
    type: 'project',
    nodeIds: [],
    label: panelText('全部论文', 'All papers')
  };
}

function researchTabNodes(tab) {
  if (!tab || tab.type === 'project') return visibleNodes();
  const ids = new Set(tab.nodeIds || []);
  return nodes.filter((item) => ids.has(item.id));
}

function researchTabChatKey(tab) {
  // Unscoped legacy history is retained, never attributed to a new project.
  return researchChatKey(currentProjectId,tab);
}

function leaveResearchProject(){
 for(const [key,run] of researchRequests)if(key.startsWith(`litgraph.chat.v2.${currentProjectId}.`))run.pause();
 localStorage.setItem(`litgraph.researchTabs.${currentProjectId}`,JSON.stringify(researchTabs));
 closeResearchWindow();researchTabs=[];activeResearchTabId='project';
}

function ensureResearchTab(node = null) {
  if(!researchTabs.length){try{const saved=JSON.parse(localStorage.getItem(`litgraph.researchTabs.${currentProjectId}`)||'[]'),ids=new Set(nodes.map(n=>n.id));researchTabs=saved.filter(t=>['project','paper','selected'].includes(t.type)&&(t.nodeIds||[]).every(id=>ids.has(id)));}catch{researchTabs=[];}}
  if (!researchTabs.some((tab) => tab.id === 'project')) researchTabs.unshift(projectResearchTab());
  let requested = researchTabs.find((tab) => tab.id === 'project');
  if (node) {
    const id = `paper.${node.id}`;
    requested = researchTabs.find((tab) => tab.id === id);
    if (!requested) {
      requested = {
        id,
        type: 'paper',
        nodeIds: [node.id],
        label: paperAuthorYearLabel(node, 25)
      };
      researchTabs.push(requested);
    }
  } else if (selectedNodes.size) {
    const nodeIds = [...selectedNodes].sort();
    const id = `selected.${nodeIds.join('.')}`;
    requested = researchTabs.find((tab) => tab.id === id);
    if (!requested) {
      requested = {
        id,
        type: 'selected',
        nodeIds,
        label: panelText(`已选 ${nodeIds.length} 篇`, `${nodeIds.length} selected`)
      };
      researchTabs.splice(1, 0, requested);
    }
  }
  activeResearchTabId = requested.id;
}

function researchRunText(run) {
  const elapsed = formatResearchDuration(run.elapsed(), language);
  if(run.status==='pending'&&run.stage.startsWith('coverage:')){const [,done,total]=run.stage.split(':');return panelText(`范围核查 ${done} / ${total} 篇 · ${elapsed}`,`Scope review ${done} / ${total} papers · ${elapsed}`);}
  if(run.status==='pending'&&run.stage.startsWith('aggregating:'))return panelText(`正在汇总各批证据 · ${elapsed}`,`Combining batch evidence · ${elapsed}`);
  if (run.status === 'pending') { const labels={preparing:['准备请求','Preparing'],rewriting:['改写检索问题','Planning retrieval'],loading:['读取原文','Reading sources'],retrieving:['检索原文证据','Retrieving evidence'],generating:['等待模型回答','Waiting for model']}; const pair=labels[run.stage]||labels.preparing; return `${panelText(...pair)} · ${elapsed}`; }
  if (run.status === 'paused') return panelText(`已在 ${elapsed}后停止。`, `Stopped after ${elapsed}.`);
  if (run.status === 'error') return panelText(`无法完成分析：${localizedError(run.error, language)}`, `Analysis failed: ${localizedError(run.error, language)}`);
  return run.result?.answer || '';
}

function showResearchNotice(message) {
  const dialog = document.createElement('dialog');
  dialog.className = 'research-notice-dialog';
  dialog.innerHTML = `<form method="dialog"><header><strong>${panelText('研究材料', 'Research materials')}</strong><button aria-label="${panelText('关闭', 'Close')}">×</button></header><p>${escapeHtml(message)}</p><button class="primary">${panelText('知道了', 'Got it')}</button></form>`;
  document.body.appendChild(dialog); dialog.addEventListener('close', () => dialog.remove()); dialog.showModal();
}

async function addResearchFiles(chatKey, files) {
  if (researchAttachmentLoads.has(chatKey)) return;
  researchAttachmentLoads.add(chatKey); renderResearchDesk();
  const errors = [];
  try {
    for (const file of files) {
      const list = researchAttachments.get(chatKey) || [];
      if (list.length >= 6) { errors.push(panelText('每次最多添加 6 个附件。', 'Add up to 6 attachments per message.')); break; }
      try {
        let item;
        if (file.type.startsWith('image/')) {
          if (activeAIConfig().vision !== true) throw new Error(panelText('当前模型未确认支持图片输入。请改用支持图片的模型，或在模型接入中根据服务商说明启用图片能力。', 'Image support is not enabled for this model. Choose a vision-capable model, or enable image support in Model connection after checking your provider’s documentation.'));
          item = await imageAttachment(file);
          if (list.reduce((total, a) => total + (a.image?.length || 0), item.image.length) > 8000000) throw new Error(panelText('本次图片总大小过大，请控制在约 6 MB 以内。', 'Images are too large. Keep the combined size under approximately 6 MB.'));
        } else item = { id: crypto.randomUUID(), name: file.name, document: await extractFile(file) };
        researchAttachments.set(chatKey, [...list, item]);
      } catch (error) { errors.push(`${file.name}: ${localizedError(error, language)}`); }
    }
  } finally {
    researchAttachmentLoads.delete(chatKey);
    if (deepReadWindow?.dataset.chatKey === chatKey) renderResearchDesk();
    if (errors.length) showResearchNotice(errors.join('\n'));
  }
}

function updateResearchSendButton(element, chatKey) {
  const run = researchRequests.get(chatKey);
  const hasDraft = Boolean(researchDrafts.get(chatKey)?.trim());
  const mode = run?.status === 'pending' ? 'pause' : run?.status === 'paused' && !hasDraft ? 'resume' : 'send';
  const button = element.querySelector('.research-send');
  if (!button) return;
  button.dataset.mode = mode;
  button.disabled = mode === 'send' && !hasDraft;
  const label = mode === 'pause' ? panelText('暂停当前回答', 'Pause answer') : mode === 'resume' ? panelText('继续：重新请求上一条消息', 'Continue: retry previous message') : panelText('发送并分析', 'Send and analyze');
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${mode === 'pause' ? '<path d="M9 5v14M15 5v14"/>' : mode === 'resume' ? '<path d="m9 5 11 7-11 7Z"/>' : '<path d="M12 19V5m-6 6 6-6 6 6"/>'}</svg>`;
}

function launchResearchRequest(chatKey, buildMessages, responseId, requestedMode = 'quick') {
  const config = activeAIConfig();
  const mode = normalizeResearchMode(requestedMode);
  let requestEvidence=[];
  const run = new ResearchRequest(async (signal, onStage, onPartial) => {
    const { messages: requestMessages, evidence, coverageNotice, reviewLedger } = await buildMessages(signal, config, mode, onStage);
    requestEvidence=evidence;
    onStage('generating');
    let question='';try{question=JSON.parse(requestMessages.at(-1).content)?.research_question||'';}catch{}
    const present=text=>compactResearchAnswer(text,language,{diagnostics:asksRetrievalDiagnostics(question)});
    let answer;
    try { answer = await callAI(requestMessages, config, researchTokenBudget(config, mode), { signal, json: true, researchMode: mode,onText:raw=>onPartial(present(partialAnswer(raw))) }); }
    catch (error) {
      if (error.name === 'TypeError') throw new Error(panelText('无法连接模型服务，请检查网络、API 地址及浏览器跨域权限后重试', 'Cannot reach the model service. Check your network, API URL and CORS permissions.'));
      throw error;
    }
    const parsed = normalizeResearchResult(answer);
    const followups = parsed.suggested_followups;
    const grounded=groundedEvidenceAnswer(present(parsed.answer),evidence,language);
    return { ...grounded,answer:coverageNotice?`${grounded.answer}\n\n> ${coverageNotice}`:grounded.answer,reviewLedger, suggested_followups: followups };
  }, (state, event) => {
    if (researchRequests.get(chatKey) !== state) return;
    const windowMatches = deepReadWindow?.isConnected && deepReadWindow.dataset.chatKey === chatKey;
    if (event === 'tick') {
      if (windowMatches) {
        const status = deepReadWindow.querySelector('[data-research-progress] p');
        if (status) status.textContent = researchRunText(state);
        if(state.partial){let preview=deepReadWindow.querySelector('[data-stream-preview]');if(!preview){preview=document.createElement('div');preview.dataset.streamPreview='';preview.className='message-markdown';status?.after(preview);}preview.innerHTML=messageMarkdown(state.partial);}
      }
      return;
    }
    const messages = JSON.parse(localStorage.getItem(chatKey) || '[]');
    const message = messages.find(item => item.id === responseId);
    if (message) {
      message.status = state.status;
      message.text = researchRunText(state);
      // A genuine transport/format failure stays a failure, but do not erase
      // already streamed text. It is labelled incomplete and excluded from
      // future answer history (which only uses completed responses).
      message.partialText = state.status === 'error' && state.partial?.trim()
        ? groundedEvidenceAnswer(state.partial,requestEvidence,language).answer : undefined;
      message.elapsedMs = state.elapsed();
      message.stageTimings = {...state.timings};
      message.responseMode = mode;
      message.suggested_followups = state.status === 'done' ? state.result.suggested_followups : [];
      message.sources = state.status === 'done' ? state.result.sources : [];
      message.reviewLedger = state.status === 'done' ? state.result.reviewLedger : undefined;
      localStorage.setItem(chatKey, JSON.stringify(messages));
    }
    if (windowMatches) {
      const restoreFocus = document.activeElement === deepReadWindow.querySelector('#deep-read-input');
      renderResearchDesk();
      if (restoreFocus) deepReadWindow.querySelector('#deep-read-input').focus();
    }
    if (state.status === 'error' && /image|vision|multimodal|图片/i.test(state.error?.message || '')) showResearchNotice(panelText(`模型未能处理图片材料：${state.error.message}。请检查该模型的图片能力，或移除图片后重试。`, `The model could not process the image: ${state.error.message}. Check its image support or remove the image and retry.`));
  });
  run.retryQuick = () => {
    if (run.status !== 'error' || researchRequests.get(chatKey) !== run) return;
    localStorage.setItem('litgraph.researchMode', 'quick');
    launchResearchRequest(chatKey, buildMessages, responseId, 'quick');
  };
  researchRequests.set(chatKey, run);
  void run.start();
}

function submitResearchQuestion(element, tab, chatKey) {
  const currentRun = researchRequests.get(chatKey);
  if (currentRun?.status === 'pending') return;
  if (researchAttachmentLoads.has(chatKey)) return toast(panelText('正在读取附件，请稍候。', 'Reading attachments. Please wait.'));
  const question = element.querySelector('#deep-read-input').value.trim();
  if (!question && currentRun?.status === 'paused') { void currentRun.start(); return; }
  if (!question) return;
  if (!aiAvailable()) return toast(panelText('请先在设置中连接 AI 模型或外部 Agent', 'Connect an AI model or external agent in Settings first'));
  const messages = JSON.parse(localStorage.getItem(chatKey) || '[]');
  const priorMessages = [...messages], scopedNodes = researchTabNodes(tab).map(n => ({ ...n }));
  const attachments = [...(researchAttachments.get(chatKey) || [])];
  if (attachments.some(a => a.image) && activeAIConfig().vision !== true) return showResearchNotice(panelText('当前模型未启用图片输入。请移除图片，或在模型接入中确认该模型支持图片后再发送。', 'Image input is not enabled. Remove the image, or confirm this model supports images in Model connection before sending.'));
  const requestedMode = normalizeResearchMode(element.querySelector('#research-response-mode').value);
  const collectionCache=new Map();
  recordUse('question');
  const buildMessages = async (signal, config, mode, onStage) => {
    onStage(mode === 'expert' || needsModelQueryPlan(question,scopedNodes,priorMessages) ? 'rewriting' : 'preparing');
    const plan = await adaptiveQueryPlan(question,{mode,history:priorMessages,nodes:scopedNodes,signal,identity:JSON.stringify([config.provider,config.model,config.endpoint]),generate:(messages,planSignal)=>callAI(messages,config,700,{json:true,researchMode:'quick',signal:planSignal})});
    const policy=retrievalPolicy(plan,scopedNodes.length,mode);
    if(plan.route==='coverage'){
      const request=await prepareCollectionRequest({nodes:scopedNodes,question,history:priorMessages,plan,mode,signal,language,onStage,cache:collectionCache,
        prepare:(batch,batchPlan)=>prepareEvidence(batch,question,[],signal,42000,batchPlan,{topK:policy.topK,onStage:stage=>onStage(stage)}),
        generate:(messages,tokens)=>callAI(messages,config,tokens,{signal:AbortSignal.any([signal,AbortSignal.timeout(120000)]),json:true,researchMode:'quick'})});
      if(attachments.length){request.messages[0].content+=' This collection review uses the selected library papers only; newly attached materials were not part of its per-paper review. State that exclusion when relevant.';request.coverageNotice+=' '+panelText('本次范围核查仅处理项目论文，未纳入临时附件。','Temporary attachments were not included in this scoped library review.');}
      return request;
    }
    const context = await prepareEvidence(scopedNodes, question, attachments, signal, policy.budget,plan,{topK:policy.topK,retrievalTimeoutMs:policy.retrievalTimeoutMs,supplement:policy.supplement,onStage});
    const notice=retrievalNotice(context.retrieval,plan,language);if(notice)toast(notice);
    const textMessages = researchMessages(scopedNodes, priorMessages, question, context, mode);
    return { messages: withImages(textMessages, attachments.filter(a => a.image).map(a => a.image), config.protocol || 'openai-chat'), evidence: context.evidence };
  };
  const responseId = crypto.randomUUID();
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  messages.push({ role: 'user', text: question, time, attachments: attachments.map(a => a.name) });
  messages.push({ id: responseId, role: 'assistant', status: 'pending', text: '', time });
  localStorage.setItem(chatKey, JSON.stringify(messages));
  researchDrafts.set(chatKey, '');
  researchAttachments.delete(chatKey);
  launchResearchRequest(chatKey, buildMessages, responseId, requestedMode);
  element.querySelector('#deep-read-input').focus();
}

function renderResearchDesk() {
  const element = deepReadWindow;
  if (!element?.isConnected) return;
  element.querySelector('.research-desk-title strong').textContent = panelText('研究空间', 'Research space');
  element.querySelector('.research-desk-subtitle').textContent = panelText('回答以原文证据为依据，AI 推断会额外标出。', 'Answers are grounded in source evidence; AI inferences are explicitly marked.');
  element.querySelector('[data-close]').setAttribute('aria-label', panelText('关闭研究空间', 'Close research space'));
  researchTabs.forEach(item => {
    if (item.type === 'project') item.label = panelText('全部论文', 'All papers');
    if (item.type === 'selected') item.label = panelText(`已选 ${item.nodeIds.length} 篇`, `${item.nodeIds.length} selected`);
  });
  let tab = researchTabs.find((item) => item.id === activeResearchTabId) || researchTabs[0] || projectResearchTab();
  activeResearchTabId = tab.id;
  const scopeNodes = researchTabNodes(tab);
  const chatKey = researchTabChatKey(tab);
  const records = JSON.parse(localStorage.getItem(chatKey) || '[]');
  if (!researchRequests.has(chatKey) && records.some(message => message.status === 'pending')) {
    records.filter(message => message.status === 'pending').forEach(message => {
      message.status = 'interrupted';
      message.text = panelText('上次请求已因页面重新加载而中断，请重新发送问题。', 'The previous request was interrupted by a page reload. Please send your question again.');
    });
    localStorage.setItem(chatKey, JSON.stringify(records));
  }
  const title = tab.type === 'paper'
    ? panelText('单篇论文', 'Single paper')
    : tab.type === 'selected'
      ? panelText('多篇比较', 'Paper comparison')
      : panelText('项目知识库', 'Project knowledge base');
  const latest = records.at(-1);
  element.dataset.chatKey = chatKey;
  const pending = researchRequests.get(chatKey)?.status === 'pending';
  const responseMode = normalizeResearchMode(localStorage.getItem('litgraph.researchMode'));
  const canRetryQuick = latest?.status === 'error' && ['reasoning_only', 'output_limit'].includes(researchRequests.get(chatKey)?.error?.code);
  const promptIdeas = !pending && latest?.role === 'assistant' && Array.isArray(latest.suggested_followups)
    ? latest.suggested_followups.slice(0, 3) : [];
  element.querySelector('[data-desk-context]').textContent = `${title} · ${tab.label}`;
  element.querySelector('.deep-read-body').innerHTML = `
    <div class="research-tabbar" role="tablist" aria-label="${panelText('研究对话标签页', 'Research conversation tabs')}">
      ${researchTabs.map((item) => `<div draggable="true" data-tab-id="${escapeHtml(item.id)}" class="research-tab ${item.id === tab.id ? 'active' : ''}"><button type="button" role="tab" data-research-tab="${escapeHtml(item.id)}" aria-selected="${item.id === tab.id}"><span>${item.type === 'project' ? '◎' : item.type === 'selected' ? '≡' : '◉'}</span><b>${escapeHtml(item.label)}</b></button>${item.type === 'project' ? '' : `<button class="research-tab-close" type="button" data-close-research-tab="${escapeHtml(item.id)}" aria-label="${panelText('关闭标签页', 'Close tab')}">×</button>`}</div>`).join('')}

    </div>
    <div class="deep-read-history" aria-live="polite">
      ${records.length ? records.map((message) => `<div class="chat-turn ${message.role}" data-status="${escapeHtml(message.status || 'done')}" ${message.status === 'pending' ? 'data-research-progress' : ''}><span class="chat-avatar">${message.role === 'user' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>' : `<img src="${BRAND_MARK}" alt="">`}</span><div class="chat-message ${message.role}"><b>${message.role === 'user' ? panelText('你', 'You') : 'LitGraph AI'}</b>${message.role==='assistant'&&(!message.status||message.status==='done')?`<div class="message-markdown">${messageMarkdown(message.text)}</div>`:`<p>${escapeHtml(message.text)}</p>`}${message.attachments?.length ? `<small class="chat-attachment-names">${message.attachments.map(escapeHtml).join(' · ')}</small>` : ''}<time>${escapeHtml(message.time || panelText('刚刚', 'Now'))}${message.responseMode ? ` · ${message.responseMode === 'expert' ? panelText('专家', 'Expert') : panelText('快速', 'Quick')}` : ''}</time></div></div>`).join('') : `<div class="research-empty"><span><img src="${BRAND_MARK}" alt=""></span><strong>${tab.type === 'paper' ? panelText('从一个问题开始', 'Start with a question') : panelText('从一个可比较的问题开始', 'Start with a comparable question')}</strong><p>${tab.type === 'paper' ? panelText('询问这篇论文的方法、结论、局限或原文依据。', 'Ask about this paper’s method, findings, limitations, or source evidence.') : panelText('比较论文的共同结论、分歧、方法差异与研究空白。', 'Compare shared findings, disagreements, methodological differences, and research gaps.')}</p></div>`}
      ${canRetryQuick ? `<button type="button" class="research-retry-quick">${panelText('用快速模式重试', 'Retry in quick mode')}</button>` : ''}
      <div class="research-prompt-list">${promptIdeas.map((prompt) => `<button type="button" data-research-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join('')}</div>
    </div>
    <form class="deep-read-form">
      <div class="research-attachments">${(researchAttachments.get(chatKey) || []).map(a => `<span title="${escapeHtml(a.name)}"><span class="attachment-name">${escapeHtml(a.name)}</span><button type="button" data-remove-attachment="${a.id}" aria-label="${panelText('移除附件', 'Remove attachment')}">×</button></span>`).join('')}${researchAttachmentLoads.has(chatKey) ? `<small>${panelText('正在读取文件…', 'Reading files…')}</small>` : ''}</div>
      <input class="research-file-input" type="file" accept=".pdf,.md,.txt,.csv,.json,.tex,image/png,image/jpeg,image/webp" multiple hidden>
      <div class="research-drop-feedback" aria-live="polite">${panelText('松开即可添加研究材料', 'Drop to add research materials')}</div>
      <textarea class="research-composer-input" id="deep-read-input" rows="1" name="research-question" autocomplete="off" aria-label="${panelText('向当前标签页提问', 'Ask this tab')}" placeholder="${panelText('向当前选中论文提问', 'Ask the currently selected papers')}"></textarea>
      <div class="research-composer-row">
        <button class="research-add-file" type="button" aria-label="${panelText('添加材料', 'Add material')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
        <label class="research-mode-control" title="${panelText('回答偏好：快速优先及时作答，专家优先深入分析。这是速度与思考深度的取舍，不会更换当前模型。', 'Response preference: Quick prioritizes speed; Expert prioritizes depth. This does not switch models.')}">
          <select id="research-response-mode" aria-label="${panelText('回答偏好', 'Response preference')}" ${pending ? 'disabled' : ''}><option value="quick" ${responseMode === 'quick' ? 'selected' : ''}>${panelText('快速', 'Quick')}</option><option value="expert" ${responseMode === 'expert' ? 'selected' : ''}>${panelText('专家', 'Expert')}</option></select>
          <svg class="mode-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
        </label>
        <button class="research-send" type="button" aria-label="${pending ? panelText('正在分析', 'Analyzing') : panelText('发送并分析', 'Send and analyze')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button>
      </div>
    </form>`;
  const history = element.querySelector('.deep-read-history');
  for(const [index,message] of records.entries()){
    if(message.status!=='error'||!message.partialText)continue;
    const turn=history.querySelectorAll('.chat-turn')[index]?.querySelector('.chat-message');
    if(!turn)continue;
    const partial=document.createElement('div');partial.className='message-markdown';partial.dataset.incompleteAnswer='';
    const label=document.createElement('p');label.textContent=panelText('以下为已收到的部分回答，尚未完成，结论需核验：','Partial answer received; unfinished, and conclusions need checking:');
    partial.innerHTML=messageMarkdown(message.partialText);turn.append(label,partial);
  }
  element.querySelector('#research-response-mode').addEventListener('change', event => localStorage.setItem('litgraph.researchMode', normalizeResearchMode(event.target.value)));
  element.querySelector('.research-retry-quick')?.addEventListener('click', () => researchRequests.get(chatKey)?.retryQuick());
  const tabbar = element.querySelector('.research-tabbar');
  tabbar.addEventListener('dragstart', event => {
    const tab = event.target.closest('[data-tab-id]');
    if (!tab) return;
    draggedResearchTab=tab.dataset.tabId;
    event.dataTransfer.setData('application/x-litgraph-tab',draggedResearchTab);
    event.dataTransfer.effectAllowed='move';tab.classList.add('dragging');
    event.stopPropagation();
  });
  tabbar.addEventListener('dragover', event => {
    if (!draggedResearchTab) return;
    event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';
    tabbar.querySelectorAll('[data-drop-side]').forEach(t=>delete t.dataset.dropSide);
    const tab=event.target.closest('[data-tab-id]');
    if(tab && tab.dataset.tabId!==draggedResearchTab)tab.dataset.dropSide=event.clientX>tab.getBoundingClientRect().x+tab.getBoundingClientRect().width/2?'after':'before';
  });
  tabbar.addEventListener('drop',event=>{
    if(!draggedResearchTab)return;
    event.preventDefault();event.stopPropagation();
    const tab=event.target.closest('[data-tab-id]');
    if(tab)researchTabs=moveTab(researchTabs,draggedResearchTab,tab.dataset.tabId,tab.dataset.dropSide==='after');
    draggedResearchTab=null;renderResearchDesk();
  });
  tabbar.addEventListener('dragend',()=>{
    draggedResearchTab=null;
    tabbar.querySelectorAll('[data-drop-side]').forEach(t=>delete t.dataset.dropSide);
    tabbar.querySelectorAll('.dragging').forEach(t=>t.classList.remove('dragging'));
  });
  element.querySelectorAll('[data-research-tab]').forEach((button) => button.addEventListener('click', () => {
    activeResearchTabId = button.dataset.researchTab;
    renderResearchDesk();
  }));
  element.querySelectorAll('[data-close-research-tab]').forEach((button) => button.addEventListener('click', () => {
    researchTabs = researchTabs.filter((item) => item.id !== button.dataset.closeResearchTab);
    if (activeResearchTabId === button.dataset.closeResearchTab) activeResearchTabId = 'project';
    renderResearchDesk();
  }));
  element.querySelectorAll('[data-research-prompt]').forEach((button) => button.addEventListener('click', () => {
    const input = element.querySelector('#deep-read-input');
    input.value = button.dataset.researchPrompt;
    researchDrafts.set(chatKey, input.value);
    element.querySelector('.deep-read-form').requestSubmit();
  }));
  element.querySelector('.research-add-file').addEventListener('click', () => element.querySelector('.research-file-input').click());
  element.querySelector('.research-file-input').addEventListener('change', e => { void addResearchFiles(chatKey, [...e.target.files]); });
  element.querySelectorAll('[data-remove-attachment]').forEach(button => button.addEventListener('click', () => { researchAttachments.set(chatKey, (researchAttachments.get(chatKey) || []).filter(a => a.id !== button.dataset.removeAttachment)); renderResearchDesk(); }));
  const composerInput = element.querySelector('#deep-read-input');
  composerInput.value = researchDrafts.get(chatKey) || '';
  const resizeComposer = () => {
    composerInput.style.height = '36px';
    composerInput.style.height = `${Math.min(100, composerInput.scrollHeight)}px`;
  };
  resizeComposer();
  history.scrollTop = history.scrollHeight;
  updateResearchSendButton(element, chatKey);
  composerInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      if (!event.repeat && researchRequests.get(chatKey)?.status !== 'pending') element.querySelector('.deep-read-form').requestSubmit();
    }
  });
  element.querySelector('.research-send').addEventListener('click', () => {
    const run = researchRequests.get(chatKey);
    if (run?.status === 'pending') run.pause();
    else element.querySelector('.deep-read-form').requestSubmit();
  });
  composerInput.addEventListener('input', () => {
    researchDrafts.set(chatKey, composerInput.value);
    updateResearchSendButton(element, chatKey);
    const keepLatestVisible = history.scrollHeight - history.clientHeight - history.scrollTop < 32;
    resizeComposer();
    if (keepLatestVisible) history.scrollTop = history.scrollHeight;
  });

  element.querySelector('.deep-read-form').addEventListener('submit', event => {
    event.preventDefault();
    submitResearchQuestion(element, tab, chatKey);
  });
}

function closeResearchWindow() {
  deepReadWindow?.disposeWindow?.();
  deepReadWindow?.remove();
  deepReadWindow = null;
  document.querySelector('#research-desk-entry')?.classList.remove('active');
}

function openDeepReadWindow(node = null) {
  closeLiteratureDiscoveryWindow();
  activePanel = null;
  renderSecondaryPanel();
  ensureResearchTab(node);
  if (deepReadWindow?.isConnected) { renderResearchDesk(); return; }
  const element = document.createElement('article');
  deepReadWindow = element;
  element.className = 'summary-window deep-read-window';
  element.setAttribute('aria-label', panelText('研究空间', 'Research space'));
  element.innerHTML = `<header class="summary-window-header"><div class="research-desk-title"><img class="tool-window-logo" src="${BRAND_MARK}" alt=""><div><strong>${panelText('研究空间', 'Research space')}</strong><span class="research-desk-subtitle">${panelText('回答以原文证据为依据，AI 推断会额外标出。', 'Answers are grounded in source evidence; AI inferences are explicitly marked.')}</span><span data-desk-context hidden></span></div></div><div class="window-controls"><button type="button" data-close aria-label="${panelText('关闭研究空间', 'Close research space')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div></header><div class="deep-read-body"></div>`;
  floatingWindowLayer.appendChild(element);
  element.disposeWindow = mountResearchWindow(element, floatingWindowLayer);
  // Warm older documents without adding a maintenance task to the research UI.
  void localRequest('vector-index',{operation:'enqueue',documents:nodes.filter(n=>!n.importCanvasHidden&&n.fulltextKey).map(n=>({key:n.fulltextKey,node:{id:n.id,title:n.title,authors:n.authors,year:n.year}}))}).catch(()=>{});
  let dragDepth = 0;
  element.addEventListener('dragenter', event => { if (![...event.dataTransfer.types].includes('Files')) return; event.preventDefault(); event.stopPropagation(); dragDepth++; element.classList.add('receiving-files'); });
  element.addEventListener('dragover', event => { if (![...event.dataTransfer.types].includes('Files')) return; event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; });
  element.addEventListener('dragleave', event => { event.preventDefault(); event.stopPropagation(); if (--dragDepth <= 0) { dragDepth = 0; element.classList.remove('receiving-files'); } });
  element.addEventListener('drop', event => { event.preventDefault(); event.stopPropagation(); dragDepth = 0; element.classList.remove('receiving-files'); void addResearchFiles(element.dataset.chatKey, [...event.dataTransfer.files]); });
  element.querySelector('[data-close]').addEventListener('click', closeResearchWindow);
  document.querySelector('#research-desk-entry')?.classList.add('active');
  renderResearchDesk();
}

function paperIsProcessed(node) {
  return node.analysisStatus==='done' && node.primaryTheory!=='unclassified' && Boolean(node.markdownRelativePath || node.fulltextStatus?.startsWith('indexed'));
}
function renderInspector(node) {
  if (!node) return renderOverview();
  inspector.classList.add('open');
  inspector.setAttribute('aria-hidden', 'false');
  const theory = theoryById(node.primaryTheory);
  const keywordText = (node.keywords || []).slice(0, 5).join('，') || panelText('暂无', 'None');
  const storedStyle = localStorage.getItem('litgraph.citationStyle') || (language === 'zh' ? 'gbt' : 'apa');
  const savedStyle = language === 'en' && storedStyle === 'gbt' ? 'apa' : (storedStyle === 'cn-apa' ? 'gbt' : storedStyle);
  const abstractText = cleanAcademicText(node.abstract || panelText('暂无摘要。', 'No abstract available.'));
  inspector.dataset.nodeId = node.id;
  const summaryText = cleanAcademicText(summaryForLanguage(node, language) || panelText('当前语言的总结尚未生成。', 'A summary in this language is not available yet.'));

  inspector.innerHTML = `
    <div class="inspector-resizer" id="inspector-resizer" role="separator" aria-label="${panelText('调整详情栏宽度', 'Resize details panel')}"></div>
    <button class="inspector-close-tab" id="close-inspector" type="button" aria-label="${panelText('关闭详情', 'Close details')}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 2.5 7 7m0-7-7 7"/></svg></button>
    <button id="delete-inspector-paper" class="inspector-delete-action" type="button">${panelText('删除该文献','Delete this paper')}</button>
    <div class="paper-hero">
      <div class="paper-badges">
        <span class="badge badge-year"><b>${panelText('年份', 'Year')}：</b>${node.year || panelText('未知','Unknown')}</span>
        <span class="badge badge-journal"><b>${panelText('期刊', 'Journal')}：</b>${escapeHtml(node.journal || panelText('未知', 'Unknown'))}</span>
        <span class="badge badge-type"><b>${panelText('类型', 'Type')}：</b>${escapeHtml(node.articleType || panelText('研究文章', 'Research article'))}</span>
        <span class="badge badge-keyword keyword-badge"><b>${panelText('关键词', 'Keywords')}：</b>${escapeHtml(keywordText)}</span>
        <span class="badge badge-citation" title="${escapeHtml([node.citationSource,node.citationRetrievedAt?.slice(0,10)].filter(Boolean).join(' · '))}"><b>${t('citations')}：</b>${formatNumber(node.citations)}</span>
      </div>
      <h2><button id="paper-title-link" type="button">${escapeHtml(node.title)}</button></h2>
      <p class="paper-authors">${escapeHtml(node.authors.join(', '))}</p>
      <a class="paper-doi" href="${escapeHtml(paperSource(node))}" target="_blank" rel="noreferrer">${escapeHtml(node.doi || node.url || panelText('无 DOI / URL', 'No DOI / URL'))}</a>
      <div class="paper-actions">
        <button id="open-pdf-button" type="button" ${node.sampleMarkdown && !node.hasPdf && !node.originalRelativePath ? `disabled title="${panelText('样例仅附带 MD，未附带 PDF', 'Sample includes Markdown, not PDF')}"` : ''}><span class="action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"><path d="M7 3.5h7l3 3V20H7z"/><path d="M14 3.5V7h3M10 11h4M10 14h4"/></svg></span><b>${panelText('原文', 'Full text')}</b></button>
        <button id="ask-paper-button" type="button"><span class="action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"><circle cx="11" cy="11" r="7"/><path d="m16.2 16.2 4.3 4.3M8.5 9h5M8.5 12h3.5"/></svg></span><b>${panelText('探索', 'Explore')}</b></button>
        <button id="citation-button" type="button" aria-expanded="false"><span class="action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"><path d="M5 7.5h5v5H7.5A3.5 3.5 0 0 1 4 16M14 7.5h5v5h-2.5A3.5 3.5 0 0 1 13 16"/></svg></span><b>${panelText('引用', 'Cite')}</b></button>
      </div>
      <p class="paper-fulltext-status" title="${escapeHtml(node.fulltextError||'')}">${node.sampleMarkdown && !node.hasPdf?panelText('样例已附带 MD 原文 · 可直接提问 · 未附带 PDF','Sample Markdown available · ready for questions · PDF not included'):node.fulltextStatus==='indexed'?panelText('原文索引已保存至本地','Full-text index saved locally'):node.fulltextStatus==='indexed_browser_only'?panelText('原文已索引 · 仅浏览器保存，请导出备份','Indexed in this browser only; export a backup'):node.originalRelativePath?panelText('PDF 已保存 · 原文尚需转换 / OCR','PDF saved · text extraction / OCR needed'):panelText('原文未索引 · 可将 PDF 拖入研究空间补充','Full text not indexed · add a PDF in Research space')}</p>
      ${!node.hasPdf?`<button id="institution-paper-button" class="paper-process-action" type="button">${panelText('通过机构获取原文','Get full text through institution')}</button>`:''}
      <div class="citation-panel" id="citation-panel" hidden>
        <label>${panelText('参考文献格式', 'Citation style')}<select id="citation-style"><option value="apa" ${savedStyle === 'apa' ? 'selected' : ''}>APA 7</option><option value="chicago" ${savedStyle === 'chicago' ? 'selected' : ''}>Chicago</option><option value="harvard" ${savedStyle === 'harvard' ? 'selected' : ''}>Harvard</option><option value="mla" ${savedStyle === 'mla' ? 'selected' : ''}>MLA 9</option>${language === 'zh' ? `<option value="gbt" ${savedStyle === 'gbt' ? 'selected' : ''}>GB/T 7714—2015</option>` : ''}</select></label>
        <p id="citation-preview">${escapeHtml(citationText(node, savedStyle))}</p><button id="copy-citation" type="button">${panelText('复制参考文献', 'Copy citation')}</button>
      </div>
    </div>
    <section class="detail-section editable-conclusion"><h3>${panelText('AI 总结', 'AI summary')}</h3><p class="ai-summary-copy" id="editable-summary" contenteditable="true" spellcheck="true">${escapeHtml(summaryText)}</p>${paperIsProcessed(node)?'':`<button id="process-paper-button" class="paper-process-action" type="button" ${discoveryImporting || discoverySearching ? 'disabled' : ''}>${panelText('本地转换并分析', 'Convert locally and analyze')}</button>`}${node.processingError ? `<small role="status" class="paper-processing-error">${escapeHtml(localizedError(node.processingError,language))}</small>` : ''}</section>
    <section class="detail-section abstract-section"><h3>${panelText('摘要', 'Abstract')}</h3><p id="editable-abstract" contenteditable="true" spellcheck="true">${escapeHtml(abstractText)}</p></section>
    ${node.fulltextError ? `<section class="detail-section"><h3>${panelText('原文状态', 'Full-text status')}</h3><p>${escapeHtml(localizedError(node.fulltextError, language))}</p></section>` : ''}
    <div class="inspector-watermark" aria-hidden="true"><img src="${BRAND_MARK}" alt=""></div>`;

  inspector.querySelectorAll('svg').forEach((icon) => icon.setAttribute('aria-hidden', 'true'));

  bindInspectorResizer();
  inspector.querySelector('#close-inspector').addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeInspectorPanel();
  });
  document.querySelector('#paper-title-link').addEventListener('click', () => openPaper(node));
  document.querySelector('#open-pdf-button').addEventListener('click', () => openPaper(node));
  document.querySelector('#process-paper-button')?.addEventListener('click', () => void processSinglePaper(node));
  document.querySelector('#institution-paper-button')?.addEventListener('click',()=>void openInstitutionWindow(node));
  document.querySelector('#delete-inspector-paper').addEventListener('click',()=>void deletePaperNodes([node.id]));
  document.querySelector('#ask-paper-button').addEventListener('click', () => openDeepReadWindow(node));
  document.querySelector('#citation-button').addEventListener('click', (event) => {
    const panel = document.querySelector('#citation-panel');
    panel.hidden = !panel.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
  });
  document.querySelector('#citation-style').addEventListener('change', (event) => {
    localStorage.setItem('litgraph.citationStyle', event.target.value);
    document.querySelector('#citation-preview').textContent = citationText(node, event.target.value);
  });
  document.querySelector('#copy-citation').addEventListener('click', async () => {
    await navigator.clipboard.writeText(document.querySelector('#citation-preview').textContent);
    toast(panelText('参考文献已复制', 'Citation copied'));
  });
  document.querySelector('#editable-abstract').addEventListener('input', (event) => { node.abstract = event.target.innerText.trim(); });
  document.querySelector('#editable-summary').addEventListener('input', (event) => {
    node[language === 'en' ? 'aiSummaryEn' : 'aiSummaryZh'] = event.target.innerText.trim();
    delete node[language === 'en' ? 'aiSummaryZh' : 'aiSummaryEn'];
    node.summary = event.target.innerText.trim(); saveCurrentProject();
  });
  void ensureSummaryLanguage(node, language);
}

async function ensureSummaryLanguage(node, targetLanguage, retry = false) {
  if (node.analysisStatus && node.analysisStatus !== 'done' || /等待生成项目内总结|Awaiting a project summary/.test(node.summary || '')) return;
  if (summaryForLanguage(node, targetLanguage)) return;
  const source = String(node.aiSummaryZh || node.aiSummaryEn || node.summary || '').trim();
  if (!source) return;
  const projectId = currentProjectId, field = targetLanguage === 'en' ? 'aiSummaryEn' : 'aiSummaryZh';
  const key = `${projectId}:${node.id}:${targetLanguage}:${source}`;
  const visible = () => currentProjectId === projectId && language === targetLanguage && inspector.dataset.nodeId === node.id;
  const display = text => { if (visible()) inspector.querySelector('#editable-summary').textContent = text; };
  if (!aiAvailable()) {
    display(targetLanguage === 'en' ? 'Connect an AI model to translate this summary into English.' : '请接入 AI 模型以翻译当前总结。'); return;
  }
  if (summaryTranslations.get(key) === 'pending') { display(targetLanguage === 'en' ? 'Translating summary…' : '正在翻译总结…'); return; }
  if (summaryTranslations.get(key) === 'error' && !retry) { display(targetLanguage === 'en' ? 'Summary translation failed. Reconnect your model and retry.' : '总结翻译失败，请检查模型接入后重试。'); return; }
  summaryTranslations.set(key, 'pending');
  display(targetLanguage === 'en' ? 'Translating summary…' : '正在翻译总结…');
  try {
    const translated = (await callAI(summaryTranslationMessages(source, targetLanguage), activeAIConfig(), 8192, { researchMode: 'quick' })).trim();
    if (!translated || (targetLanguage === 'en' && /[\u3400-\u9fff]/.test(translated))) throw new Error('The model did not return the requested language.');
    if (currentProjectId !== projectId || source !== String(node.aiSummaryZh || node.aiSummaryEn || node.summary || '').trim() || node[field]) return;
    node[field] = translated; summaryTranslations.delete(key); saveCurrentProject(); display(cleanAcademicText(translated));
  } catch (error) {
    summaryTranslations.set(key,'error');
    display(targetLanguage === 'en' ? `Summary translation failed: ${localizedError(error,'en')}` : `总结翻译失败：${localizedError(error,'zh')}`);
    if (visible()) {
      const button=document.createElement('button');button.type='button';button.className='summary-translate-retry';
      button.textContent=targetLanguage==='en'?'Retry translation':'重新翻译';
      button.addEventListener('click',()=>{button.remove();void ensureSummaryLanguage(node,targetLanguage,true);});
      inspector.querySelector('.editable-conclusion').appendChild(button);
    }
  }
}

function cleanAcademicText(value) {
  return String(value || '')
    .replace(/---\s*Page\s+\d+\s*---/gi, ' ')
    .replace(/\u0000/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([A-Za-z])-\s+([a-z])/g, '$1$2')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function renderFilters() {
  const theoryHost = document.querySelector('#theory-filters');
  if (!theoryHost) return;
  theoryHost.innerHTML = project.theories.map((theory) => {
    const count = nodes.filter((node) => node.primaryTheory === theory.id).length;
    const label = language === 'en' ? (theory.labelEn || theory.label) : theory.label;
    return `<label class="filter-row"><input type="checkbox" data-theory="${escapeHtml(theory.id)}" ${enabledTheories.has(theory.id) ? 'checked' : ''}/><i class="legend-dot" style="background:${theory.color}"></i><span>${escapeHtml(label)}</span><span class="filter-count">${count}</span></label>`;
  }).join('');
  theoryHost.querySelectorAll('[data-theory]').forEach((input) => input.addEventListener('change', (event) => {
    if (event.target.checked) enabledTheories.add(event.target.dataset.theory);
    else enabledTheories.delete(event.target.dataset.theory);
    applyActiveFilters();
  }));

  const relationHost = document.querySelector('#relation-filters');
  if (relationHost) {
    relationHost.innerHTML = Object.entries(RELATION_LABELS).map(([id]) => `
      <label class="filter-row"><input type="checkbox" data-relation="${id}" ${enabledRelations.has(id) ? 'checked' : ''}/><i class="legend-line" style="background:${edgeColor({ relation: id, strength: id === 'related' ? 3 : 4 })}"></i><span>${t(id)}</span></label>
    `).join('');
    relationHost.querySelectorAll('[data-relation]').forEach((input) => input.addEventListener('change', (event) => {
      if (event.target.checked) enabledRelations.add(event.target.dataset.relation);
      else enabledRelations.delete(event.target.dataset.relation);
      applyActiveFilters();
    }));
  }

  document.querySelector('#year-start-filter')?.addEventListener('change', (event) => { filterState.yearStart = event.target.value; applyActiveFilters(); });
  document.querySelector('#year-end-filter')?.addEventListener('change', (event) => { filterState.yearEnd = event.target.value; applyActiveFilters(); });
  document.querySelectorAll('[data-journal-choice]').forEach(input => input.addEventListener('change', () => {
    filterState.journals = [...document.querySelectorAll('[data-journal-choice]:checked')].map(i => i.value);
    document.querySelector('#journal-filter > summary').textContent = filterState.journals.length ? panelText(`已选 ${filterState.journals.length} 个期刊`,`${filterState.journals.length} journals selected`) : panelText('全部期刊','All journals');
    applyActiveFilters();
  }));
  document.querySelector('#journal-filter-all')?.addEventListener('click', () => { filterState.journals = []; applyActiveFilters(); renderSecondaryPanel(); });
  document.querySelector('#fulltext-filter')?.addEventListener('change', (event) => { filterState.fulltext = event.target.value; applyActiveFilters(); });
}

function applyActiveFilters() {
  if (graphLocked) {
    rebuildActiveLinks();
    simulation.stop();
    updateCounters();
    render();
    return;
  }
  configureSimulation();
}

function panelText(zh, en) {
  return language === 'en' ? en : zh;
}

function helpButton(topic, brief) {
  return `<span class="help-tip" tabindex="0" data-help-text="${escapeHtml(brief)}" aria-label="${escapeHtml(brief)}"></span>`;
}

function sliderControl(id, label, min, max, value, suffix = '', help = '', helpTopic = '') {
  const helpControl = help ? helpButton(helpTopic, help) : '';
  return `<div class="control"><label for="${id}"><span class="control-label">${label}${helpControl}</span><output id="${id}-output">${value}${suffix}</output></label><input id="${id}" aria-label="${label}" type="range" min="${min}" max="${max}" value="${value}" /></div>`;
}

function renderSecondaryPanel() {
  document.querySelectorAll('[data-panel]').forEach((button) => button.classList.toggle('active', button.dataset.panel === activePanel));
  if (!activePanel) {
    window.clearTimeout(secondaryPanelCloseTimer);
    secondaryPanel.classList.remove('open');
    secondaryPanel.setAttribute('aria-hidden', 'true');
    secondaryPanelCloseTimer = window.setTimeout(() => {
      if (!activePanel) secondaryPanel.innerHTML = '';
    }, 240);
    return;
  }
  window.clearTimeout(secondaryPanelCloseTimer);
  const wasOpen = secondaryPanel.classList.contains('open');
  const s = settings();
  const titles = {
    'view-mode': panelText('查看方式', 'View mode'),
    nodes: panelText('节点', 'Nodes'), edges: panelText('边', 'Edges'), labels: panelText('标签', 'Labels'),
    background: t('background'),
    filters: panelText('筛选', 'Filters'), statistics: panelText('统计', 'Statistics'),
    'workspace-settings': panelText('设置', 'Settings'),
    'literature-discovery': panelText('文献发现', 'Literature discovery')
  };
  let body = '';
  if (activePanel === 'view-mode') {
    const layoutHelp = panelText('理论聚类布局综合理论分类、支持、反对、相关关系与节点斥力进行聚类，节点越近表示理论归属或论证关系越接近。\n语义向量布局依据标题与摘要的文本语义向量排列，节点越近表示文本内容越相似。', 'Theory-cluster layout combines theory categories, support, opposition, relatedness, and repulsion; closer nodes indicate a closer theory assignment or argument relation.\nSemantic-vector layout uses title-and-abstract semantic vectors; closer nodes indicate more similar text content.');
    body = `<div class="view-choice-block"><div class="view-choice-header"><span>${panelText('布局依据', 'Layout basis')}</span>${helpButton('layout-basis', layoutHelp)}</div><div class="segmented-control" role="group" aria-label="${panelText('选择节点布局依据', 'Choose layout basis')}"><button type="button" data-layout-basis="argument" class="${layoutBasis === 'argument' ? 'active' : ''}" aria-pressed="${layoutBasis === 'argument'}">${panelText('理论聚类布局', 'Theory clusters')}</button><button type="button" data-layout-basis="semantic" class="${layoutBasis === 'semantic' ? 'active' : ''}" aria-pressed="${layoutBasis === 'semantic'}">${panelText('语义向量布局', 'Semantic vectors')}</button></div></div>
     <div class="view-choice-block"><div class="view-choice-header"><span>${panelText('空间维度', 'Spatial dimension')}</span></div><div class="segmented-control compact" role="group" aria-label="${panelText('选择空间维度', 'Choose spatial dimension')}"><button type="button" data-render-mode="2d" class="${renderMode === '2d' ? 'active' : ''}" aria-pressed="${renderMode === '2d'}">2D</button><button type="button" data-render-mode="3d" class="${renderMode === '3d' ? 'active' : ''}" aria-pressed="${renderMode === '3d'}">3D</button></div></div>`;
    if (view === 'timeline') {
    body += `<div class="relation-layer-control"><span>${panelText('连线内容', 'Edge content')}</span><div role="group" aria-label="${panelText('选择年份树显示的关系类型', 'Choose relationship content shown on the timeline')}"><button type="button" data-timeline-layer="citation" class="${s.relationLayer === 'citation' ? 'active' : ''}" aria-pressed="${s.relationLayer === 'citation'}">${panelText('引用关系', 'Citations')}</button><button type="button" data-timeline-layer="argument" class="${s.relationLayer === 'argument' ? 'active' : ''}" aria-pressed="${s.relationLayer === 'argument'}">${panelText('论证关系', 'Arguments')}</button></div></div><label class="switch-row"><span><strong>${panelText('年份轴', 'Year axis')}</strong><small>${panelText('在 2D 与 3D 中显示年份参考线或平面', 'Show year guides or planes in 2D and 3D')}</small></span><input id="year-axis-input" type="checkbox" ${s.showYearAxis ? 'checked' : ''}/><i></i></label>${sliderControl('year-spacing', panelText('年份间距', 'Year spacing'), 30, 220, s.yearSpacing || 72, '', panelText('控制相邻发表年份在时间轴上的距离。数值越大，不同年份之间越疏朗。', 'Controls the distance between adjacent publication years.'))}${sliderControl('cohort-spread', panelText('同年横向展开度', 'Within-year horizontal spread'), 30, 2000, s.cohortSpread || 430, '%', panelText('控制同一年论文在年份层内横向展开的程度，不改变论文所属年月。', 'Controls how widely papers spread within the same year layer without changing publication time.'))}<button class="panel-primary" id="reset-button" type="button">${panelText('重新排列年份树', 'Re-run timeline')}</button>`;
    }
  } else if (activePanel === 'nodes') {
    body = `
      ${sliderControl('node-charge', panelText('节点斥力', 'Repulsion'), 40, 4000, s.charge, '', panelText('控制所有未固定节点彼此排斥的力度。数值越大，聚落越展开；被固定的节点不会被斥力推动。', 'Controls how strongly unfixed nodes repel one another. Higher values spread clusters further; fixed nodes are unaffected.'), 'repulsion')}
      ${sliderControl('node-size', panelText('节点整体大小', 'Overall size'), 0, 1000, s.nodeSize, '%', panelText('同时缩放所有论文节点。', 'Scales all paper nodes together.'), 'node-size')}
      ${sliderControl('node-difference', panelText('节点大小差异度', 'Size contrast'), 10, 500, s.sizeDifference, '%', panelText('放大或压缩高被引与低被引论文的尺寸差异。', 'Expands or compresses the visual size gap between highly and lightly cited papers.'), 'size-contrast')}
      ${sliderControl('color-vibrance', panelText('颜色鲜艳度', 'Color vibrance'), 0, 200, s.colorVibrance, '%', panelText('增强或减弱理论颜色的鲜明程度。', 'Changes how vivid theory colors appear.'), 'color-vibrance')}
      <div class="palette-control"><span class="control-label">${panelText('风格', 'Style')}</span><div class="palette-grid">
        ${Object.entries(PALETTES).map(([id, colors], index) => `<button class="palette-button ${s.palette === id ? 'active' : ''}" data-palette="${id}" type="button" aria-label="${panelText(`色系 ${index + 1}`, `Palette ${index + 1}`)}">${colors.slice(0, 6).map((color) => `<i style="background:${color}"></i>`).join('')}</button>`).join('')}
      </div></div>
      <button class="panel-primary" id="reset-button" type="button">${panelText('重新布局', 'Re-run layout')}</button>`;
  } else if (activePanel === 'edges') {
    body = `${sliderControl('edge-width', panelText('连线粗细', 'Edge thickness'), 0, 500, s.edgeWidth, '%')}${sliderControl('edge-vibrance', panelText('颜色鲜艳度', 'Color vibrance'), 0, 200, s.edgeVibrance, '%')}<div class="palette-control edge-palette-control"><span>${panelText('风格', 'Style')}</span><div class="palette-grid">${Object.entries(EDGE_PALETTES).map(([id, colors], index) => `<button class="palette-button ${s.edgePalette === id ? 'active' : ''}" data-edge-palette="${id}" type="button" aria-label="${panelText(`连线风格 ${index + 1}`, `Edge style ${index + 1}`)}"><i style="background:${colors.support}"></i><i style="background:${colors.oppose}"></i><i style="background:${colors.relatedStrong}"></i><i style="background:${colors.relatedWeak}"></i></button>`).join('')}</div></div>`;
  } else if (activePanel === 'labels') {
    body = `
      <label class="switch-row"><span><strong>${panelText('论文标签', 'Paper labels')}</strong><small>${panelText('可选择标题，或作者与年份的排列方式', 'Choose title or author/year ordering')}</small></span><input id="paper-labels-input" type="checkbox" ${s.paperLabels ? 'checked' : ''}/><i></i></label>
      ${s.paperLabels ? `<div class="nested-label-controls">${sliderControl('paper-label-size', panelText('论文标签字号', 'Paper label size'), 65, 170, s.paperLabelSize, '%')}<label class="switch-row compact"><span><strong>${panelText('已读 / 未读标记', 'Read / unread markers')}</strong><small>${panelText('显示论文标签左侧的小圆点', 'Show the small marker left of each paper label')}</small></span><input id="read-markers-input" type="checkbox" ${s.readMarkers ? 'checked' : ''}/><i></i></label><fieldset class="label-mode-options"><legend>${panelText('标签内容', 'Label content')}</legend><label><input type="radio" name="paper-label-mode" value="authors-year" ${s.paperLabelMode === 'authors-year' ? 'checked' : ''}><span>${panelText('作者 / 年份', 'Authors / year')}</span></label><label><input type="radio" name="paper-label-mode" value="year-authors" ${s.paperLabelMode === 'year-authors' ? 'checked' : ''}><span>${panelText('年份 / 作者', 'Year / authors')}</span></label><label><input type="radio" name="paper-label-mode" value="title" ${s.paperLabelMode === 'title' ? 'checked' : ''}><span>${panelText('论文标题', 'Paper title')}</span></label></fieldset></div>` : ''}
      ${view === 'semantic' ? `<label class="switch-row"><span><strong>${panelText('群组标签', 'Group labels')}</strong><small>${panelText('自动避开密集节点，并随聚落移动', 'Avoids dense nodes and stays attached to its cluster')}</small></span><input id="theory-labels-input" type="checkbox" ${s.theoryLabels ? 'checked' : ''}/><i></i></label>${sliderControl('theory-label-size', panelText('群组标签字号', 'Group label size'), 65, 170, s.theoryLabelSize, '%')}` : ''}`;
  } else if (activePanel === 'background') {
    body = `<div class="background-options" role="group" aria-label="${t('background')}">${CANVAS_BACKGROUNDS.map(p => `<button type="button" class="background-option" data-canvas-background="${p.id}" aria-label="${p[language]}" title="${p[language]}" aria-pressed="${p.id === currentBackground().id}"><img src="${backgroundArtwork(p.id, 220, 140).toDataURL()}" alt=""></button>`).join('')}</div>`;
  } else if (activePanel === 'filters') {
    const journals = [...new Set(nodes.map((node) => node.journal).filter(Boolean))].sort();
    body = `<div class="subheading"><span>${panelText('论文范围', 'Paper scope')}</span><small>${panelText('组合筛选', 'Combined filters')}</small></div>
      <div class="filter-controls"><label><span>${panelText('起止年份', 'Year range')}</span><div><input id="year-start-filter" type="number" min="1900" max="2100" value="${escapeHtml(filterState.yearStart)}" placeholder="2017"><b>—</b><input id="year-end-filter" type="number" min="1900" max="2100" value="${escapeHtml(filterState.yearEnd)}" placeholder="2026"></div></label>
      <div class="journal-filter-field"><span>${panelText('期刊 / 来源', 'Journal / source')}</span><details id="journal-filter"><summary>${filterState.journals.length ? panelText(`已选 ${filterState.journals.length} 个期刊`, `${filterState.journals.length} journals selected`) : panelText('全部期刊', 'All journals')}</summary><div class="journal-choices"><button type="button" id="journal-filter-all">${panelText('显示全部', 'Show all')}</button>${journals.map(journal => `<label><input type="checkbox" data-journal-choice value="${escapeHtml(journal)}" ${filterState.journals.includes(journal) ? 'checked' : ''}><span>${escapeHtml(journal)}</span></label>`).join('')}</div></details></div>
      <label><span>${panelText('本地原文', 'Local full text')}</span><select id="fulltext-filter"><option value="all" ${filterState.fulltext === 'all' ? 'selected' : ''}>${panelText('全部', 'All')}</option><option value="yes" ${filterState.fulltext === 'yes' ? 'selected' : ''}>${panelText('有原文', 'Available')}</option><option value="no" ${filterState.fulltext === 'no' ? 'selected' : ''}>${panelText('无原文', 'Missing')}</option></select></label></div>
      <div class="subheading relation-subheading"><span>${panelText('主要理论', 'Primary theories')}</span><small>${panelText('AI 识别全部类别', 'All AI-detected classes')}</small></div><div id="theory-filters"></div>${view === 'semantic' || settings().relationLayer === 'argument' ? `<div class="subheading relation-subheading"><span>${panelText('关系类型', 'Relation types')}</span><small>${panelText('可组合', 'Combinable')}</small></div><div id="relation-filters"></div>` : ''}`;
  } else if (activePanel === 'statistics') {
    const visible = visibleNodes();
    const citationValues = visible.map((node) => Number(node.citations) || 0).sort((a, b) => a - b);
    const median = citationValues[Math.floor(citationValues.length / 2)] || 0;
    const journals = new Set(visible.map((node) => node.journal).filter(Boolean));
    const readCount = visible.filter((node) => node.read).length;
    body = `<div class="metric-grid"><div><strong>${visible.length}</strong><span>${t('papers')}</span></div><div><strong>${activeLinks.length}</strong><span>${t('relations')}</span></div><div><strong>${formatNumber(median)}</strong><span>${panelText('引用中位数', 'Median cites')}</span></div><div><strong>${visible.filter((node) => node.hasPdf).length}</strong><span>${panelText('本地全文', 'Local full text')}</span></div><div><strong>${journals.size}</strong><span>${panelText('期刊来源', 'Journal sources')}</span></div><div><strong>${readCount}</strong><span>${panelText('已读论文', 'Read papers')}</span></div><div><strong>${visible.length - readCount}</strong><span>${panelText('未读论文', 'Unread papers')}</span></div><div><strong>${visible.length ? Math.round(readCount / visible.length * 100) : 0}%</strong><span>${panelText('阅读进度', 'Reading progress')}</span></div></div>`;
  } else if (activePanel === 'workspace-settings') {
    body = `<div class="workspace-settings-list">
      <p>${panelText('项目', 'Project')}</p>
      <button type="button" data-workspace-action="new"><span><strong>${panelText('新建本地项目', 'New local project')}</strong><small>${panelText('创建一个空白研究项目', 'Create a blank research project')}</small></span></button>
      <button type="button" data-workspace-action="import"><span><strong>${panelText('导入项目数据', 'Import project data')}</strong><small>LitGraph JSON</small></span></button>
      <button type="button" data-workspace-action="export"><span><strong>${panelText('导出项目数据', 'Export project data')}</strong><small>LitGraph JSON</small></span></button>
      <button type="button" data-workspace-action="data-folder"><span><strong>${panelText('数据文件夹', 'Data folder')}</strong><small>${panelText('原文、MD、分析与项目数据', 'Originals, Markdown, analysis and project data')}</small></span></button>
      <button type="button" data-workspace-action="reset-settings"><span><strong>${panelText('还原所有设置', 'Reset all settings')}</strong><small>${panelText('清除连接和界面设置，保留全部研究数据', 'Reset connections and preferences; keep all research data')}</small></span></button>
      <button type="button" class="danger" data-workspace-action="clear-data"><span><strong>${panelText('清除数据', 'Clear data')}</strong><small>${panelText('清除本地研究数据，自带样例始终保留', 'Clear local research data; bundled sample is always retained')}</small></span></button>
      <p>${panelText('连接与应用', 'Connections & app')}</p>
      <button type="button" data-workspace-action="api"><span><strong>${panelText('模型接入', 'AI connection')}</strong><small>${panelText('配置模型、API 地址与密钥', 'Configure model, API URL and key')}</small></span></button>
      <a href="https://litgraph.aobi.qzz.io/" target="_blank" rel="noopener noreferrer"><span><strong>${panelText('产品网站', 'Product website')}</strong><small>${panelText('了解产品与下载使用', 'Explore LitGraph and download the app')}</small></span></a>
      <button type="button" data-workspace-action="about"><span><strong>${panelText('关于 LitGraph', 'About LitGraph')}</strong><small>Version ${APP_VERSION}</small></span></button>
      <a href="https://my.feishu.cn/share/base/form/shrcnbw8bQOlnsv8EXdKFaXnoIy" target="_blank" rel="noopener noreferrer"><span><strong>${panelText('用户反馈', 'User feedback')}</strong><small>${panelText('反馈问题或分享使用建议', 'Report an issue or share a suggestion')}</small></span></a>
    </div>`;
  } else if (activePanel === 'literature-discovery') {
    body = `<div class="discovery-panel">
      <label for="discovery-query"><span>${panelText('你想研究什么？', 'What do you want to study?')}</span><textarea id="discovery-query" rows="5" placeholder="${panelText('描述研究问题、主题或希望验证的想法…', 'Describe a research question, topic, or idea to verify…')}"></textarea></label>
      <label for="discovery-source"><span>${panelText('检索范围', 'Search scope')}</span><select id="discovery-source"><option value="scholarly">${panelText('综合学术来源', 'Multiple scholarly sources')}</option><option value="open">${panelText('优先开放获取', 'Open access first')}</option><option value="local">${panelText('当前项目补充检索', 'Expand current project')}</option></select></label>
      <div class="discovery-output"><strong>${panelText('自动处理', 'Automatic processing')}</strong><span><i>✓</i>${panelText('筛选并去除重复论文', 'Filter and remove duplicates')}</span><span><i>✓</i>${panelText('保存 DOI、完整作者、年份与参考文献', 'Save DOI, complete authors, year and references')}</span><span><i>✓</i>${panelText('从学术来源保存规范摘要与原文地址', 'Save the canonical abstract and source URL')}</span></div>
      <button class="panel-primary" id="start-discovery" type="button">${panelText('检索并导入', 'Search and import')}</button>
      <p class="discovery-note">${panelText('论文会按 DOI 与学术记录去重，再加入当前项目。', 'Papers are deduplicated by DOI and scholarly record before import.')}</p>
    </div>`;
  }
  const titleMarkup = activePanel === 'view-mode' ? '' : `<strong>${titles[activePanel]}</strong>`;
  secondaryPanel.innerHTML = `<header class="${activePanel === 'view-mode' ? 'titleless' : ''}">${titleMarkup}<button id="close-secondary" type="button" aria-label="${panelText('关闭二级菜单', 'Close submenu')}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="secondary-content">${body}</div>`;
  secondaryPanel.querySelectorAll('svg').forEach((icon) => icon.setAttribute('aria-hidden', 'true'));
  secondaryPanel.setAttribute('aria-hidden', 'false');
  if (wasOpen) secondaryPanel.classList.add('open');
  else window.requestAnimationFrame(() => secondaryPanel.classList.add('open'));
  document.querySelector('#close-secondary').addEventListener('click', () => { activePanel = null; renderSecondaryPanel(); });
  secondaryPanel.querySelectorAll('[data-canvas-background]').forEach(button => button.addEventListener('click', () => {
    canvasBackground = button.dataset.canvasBackground;
    localStorage.setItem('litgraph.canvasBackground', canvasBackground);
    renderSecondaryPanel(); render();
  }));

  const bindRange = (id, key, suffix = '', rerun = false) => {
    const input = document.querySelector(`#${id}`);
    if (!input) return;
    input.addEventListener('input', (event) => {
      s[key] = Number(event.target.value);
      document.querySelector(`#${id}-output`).textContent = `${s[key]}${suffix}`;
      if (key === 'yearSpacing') refreshTimelineCoordinates();
      if (key === 'cohortSpread') refreshTimelineCoordinates({ redistribute: true });
      if (renderMode === '3d') renderGraph3D(rerun);
      else if (rerun) configureSimulation();
      else render();
    });
  };
  bindRange('node-charge', 'charge', '', true);
  bindRange('node-size', 'nodeSize', '%', true);
  bindRange('node-difference', 'sizeDifference', '%', true);
  bindRange('color-vibrance', 'colorVibrance', '%');
  bindRange('edge-width', 'edgeWidth', '%');
  bindRange('edge-vibrance', 'edgeVibrance', '%');
  bindRange('year-spacing', 'yearSpacing', '', true);
  bindRange('cohort-spread', 'cohortSpread', '%', true);
  bindRange('paper-label-size', 'paperLabelSize', '%');
  bindRange('theory-label-size', 'theoryLabelSize', '%');
  document.querySelectorAll('[data-palette]').forEach((button) => button.addEventListener('click', () => applyPalette(button.dataset.palette)));
  document.querySelectorAll('[data-edge-palette]').forEach((button) => button.addEventListener('click', () => applyEdgePalette(button.dataset.edgePalette)));
  document.querySelectorAll('[data-render-mode]').forEach((button) => button.addEventListener('click', () => setRenderMode(button.dataset.renderMode)));
  document.querySelectorAll('[data-layout-basis]').forEach((button) => button.addEventListener('click', () => setLayoutBasis(button.dataset.layoutBasis)));
  document.querySelectorAll('[data-timeline-layer]').forEach((button) => button.addEventListener('click', () => {
    s.relationLayer = button.dataset.timelineLayer;
    renderSecondaryPanel();
    if (renderMode === '3d') void renderGraph3D(true);
    else configureSimulation(false);
    updateGraphLegend();
  }));
  document.querySelector('#paper-labels-input')?.addEventListener('change', (event) => { s.paperLabels = event.target.checked; renderSecondaryPanel(); render(); });
  document.querySelector('#read-markers-input')?.addEventListener('change', (event) => { s.readMarkers = event.target.checked; render(); });
  document.querySelectorAll('[name="paper-label-mode"]').forEach((input) => input.addEventListener('change', (event) => { s.paperLabelMode = event.target.value; render(); }));
  document.querySelector('#theory-labels-input')?.addEventListener('change', (event) => { s.theoryLabels = event.target.checked; render(); });
  document.querySelector('#year-axis-input')?.addEventListener('change', (event) => {
    s.showYearAxis = event.target.checked;
    if (renderMode === '3d') void renderGraph3D(false); else render();
  });
  document.querySelector('#reset-button')?.addEventListener('click', resetLayout);
  secondaryPanel.querySelectorAll('[data-workspace-action]').forEach((button) => button.addEventListener('click', () => handleWorkspaceAction(button.dataset.workspaceAction)));
  document.querySelector('#start-discovery')?.addEventListener('click', () => void runLiteratureDiscovery());
  renderFilters();
}

function applyPalette(paletteId) {
  const colors = PALETTES[paletteId] || PALETTES.p0;
  settings().palette = paletteId;
  project.theories.forEach((theory, index) => { theory.color = derivedPaletteColor(colors, index); });
  renderSecondaryPanel();
  render();
}

function applyEdgePalette(paletteId) {
  settings().edgePalette = EDGE_PALETTES[paletteId] ? paletteId : 'e0';
  renderSecondaryPanel();
  if (renderMode === '3d') void renderGraph3D(false); else render();
}

function derivedPaletteColor(colors, index) {
  const base = colors[index % colors.length];
  const cycle = Math.floor(index / colors.length);
  if (!cycle) return base;
  const amount = Math.min(0.42, 0.13 * Math.ceil(cycle / 2));
  return interpolateRgb(base, cycle % 2 ? '#f4f6f8' : '#111820')(amount);
}

function editableCell(entityId, field, value, type = 'text') {
  const safeValue = escapeHtml(value ?? '');
  if (type === 'select') return `<select data-edit-id="${escapeHtml(entityId)}" data-edit-field="${field}">${value}</select>`;
  if (type === 'checkbox') return `<input type="checkbox" aria-label="${escapeHtml(`${entityId} ${field}`)}" data-edit-id="${escapeHtml(entityId)}" data-edit-field="${field}" ${value ? 'checked' : ''}/>`;
  return `<input class="table-input" type="${type}" name="${escapeHtml(`${entityId}-${field}`)}" aria-label="${escapeHtml(`${entityId} ${field}`)}" autocomplete="off" data-edit-id="${escapeHtml(entityId)}" data-edit-field="${field}" value="${safeValue}" />`;
}

const DATA_COLUMNS = {
  nodes: [
    ['select', 38], ['preview', 54], ['id', 82], ['title', 340], ['year', 68], ['articleType', 112],
    ['journal', 170], ['citations', 78], ['fulltext', 76], ['read', 58], ['theory', 156]
  ],
  edges: [['select', 38], ['id', 92], ['source', 120], ['target', 120], ['relation', 96], ['strength', 76]]
};

function columnKey(entity, id) {
  return `${entity}.${id}`;
}

function dataColgroup(entity) {
  return `<colgroup>${DATA_COLUMNS[entity].map(([id, defaultWidth]) => `<col data-column="${id}" style="width:${dataColumnWidths[columnKey(entity, id)] || defaultWidth}px">`).join('')}</colgroup>`;
}

function resizableHeader(id, content, className = '') {
  return `<th class="${className}" data-column="${id}">${content}<span class="column-resizer" data-column-resizer="${id}" role="separator" aria-label="${panelText(`调整 ${id} 列宽`, `Resize ${id} column`)}" aria-orientation="vertical" tabindex="0"></span></th>`;
}

function bindColumnResizers() {
  const table = dataView.querySelector('.data-table');
  if (!table) return;
  table.querySelectorAll('[data-column-resizer]').forEach((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = handle.dataset.columnResizer;
      const col = table.querySelector(`col[data-column="${id}"]`);
      if (!col) return;
      const startX = event.clientX;
      const startWidth = col.getBoundingClientRect().width / PAGE_SCALE;
      handle.setPointerCapture(event.pointerId);
      const move = (moveEvent) => {
        const minWidth = id === 'title' ? 180 : 44;
        const next = Math.max(minWidth, Math.min(560, startWidth + (moveEvent.clientX - startX) / PAGE_SCALE));
        col.style.width = `${next}px`;
        dataColumnWidths[columnKey(dataEntity, id)] = Math.round(next);
      };
      const end = (upEvent) => {
        localStorage.setItem('litgraph.dataColumnWidths', JSON.stringify(dataColumnWidths));
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        if (handle.hasPointerCapture(upEvent.pointerId)) handle.releasePointerCapture(upEvent.pointerId);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
    handle.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const id = handle.dataset.columnResizer;
      const col = table.querySelector(`col[data-column="${id}"]`);
      const current = col?.getBoundingClientRect().width || 80;
      const next = Math.max(id === 'title' ? 180 : 44, current + (event.key === 'ArrowRight' ? 10 : -10));
      if (col) col.style.width = `${next}px`;
      dataColumnWidths[columnKey(dataEntity, id)] = Math.round(next);
      localStorage.setItem('litgraph.dataColumnWidths', JSON.stringify(dataColumnWidths));
    });
  });
}

function renderDataView() {
  if (view !== 'table') return;
  const previousScroll = dataView.querySelector('.data-table-wrap');
  const scroll = { top: previousScroll?.scrollTop || 0, left: previousScroll?.scrollLeft || 0 };
  const records = dataEntity === 'nodes' ? nodes : project.semanticLinks;
  const allSelected = records.length > 0 && records.every((record) => dataSelection.has(record.id));
  dataView.hidden = false;
  dataView.innerHTML = `
    <header class="data-toolbar">
      <div class="entity-tabs"><button type="button" data-entity="nodes" class="${dataEntity === 'nodes' ? 'active' : ''}">${panelText('节点', 'Nodes')} <span>${nodes.length}</span></button><button type="button" data-entity="edges" class="${dataEntity === 'edges' ? 'active' : ''}">${panelText('边', 'Edges')} <span>${project.semanticLinks.length}</span></button></div>
      <div class="data-actions"><span>${panelText(`已选择 ${dataSelection.size} 项`, `${dataSelection.size} selected`)}</span><button id="delete-data-button" type="button" ${dataSelection.size ? '' : 'disabled'}>${panelText('删除', 'Delete')}</button></div>
    </header>
    <div class="data-table-wrap"><table class="data-table">
      ${dataColgroup(dataEntity)}
      ${dataEntity === 'nodes' ? `<thead><tr>${resizableHeader('select', `<input id="select-all-data" type="checkbox" aria-label="${panelText('全选节点', 'Select all nodes')}" ${allSelected ? 'checked' : ''}>`, 'check-cell')}${resizableHeader('preview', 'Preview', 'preview-cell')}${resizableHeader('id', 'ID')}${resizableHeader('title', panelText('标题', 'Title'))}${resizableHeader('year', panelText('年份', 'Year'))}${resizableHeader('articleType', panelText('文章类型', 'Type'))}${resizableHeader('journal', panelText('期刊', 'Journal'))}${resizableHeader('citations', panelText('引用量', 'Citations'))}${resizableHeader('fulltext', panelText('本地 PDF', 'Local PDF'))}${resizableHeader('read', panelText('已读', 'Read'))}${resizableHeader('theory', panelText('主要理论', 'Primary theory'))}</tr></thead>
        <tbody>${nodes.map((node) => `<tr><td class="check-cell"><input type="checkbox" aria-label="${escapeHtml(`${panelText('选择', 'Select')} ${node.title}`)}" data-select-record="${escapeHtml(node.id)}" ${dataSelection.has(node.id) ? 'checked' : ''}></td><td class="preview-cell"><i class="node-preview" style="background:${nodeFill(node)}"></i></td><td class="mono">${escapeHtml(node.id)}</td><td>${editableCell(node.id, 'title', node.title)}</td><td>${editableCell(node.id, 'year', node.year, 'number')}</td><td>${editableCell(node.id, 'articleType', node.articleType)}</td><td>${editableCell(node.id, 'journal', node.journal)}</td><td>${editableCell(node.id, 'citations', node.citations, 'number')}</td><td class="center-cell">${editableCell(node.id, 'hasPdf', node.hasPdf, 'checkbox')}</td><td class="center-cell">${editableCell(node.id, 'read', node.read, 'checkbox')}</td><td><select aria-label="${escapeHtml(`${node.id} primary theory`)}" data-edit-id="${escapeHtml(node.id)}" data-edit-field="primaryTheory">${project.theories.map((theory) => `<option value="${escapeHtml(theory.id)}" ${node.primaryTheory === theory.id ? 'selected' : ''}>${escapeHtml(language === 'en' ? (theory.labelEn || theory.label) : theory.label)}</option>`).join('')}</select></td></tr>`).join('')}</tbody>`
        : `<thead><tr>${resizableHeader('select', `<input id="select-all-data" type="checkbox" aria-label="${panelText('全选边', 'Select all edges')}" ${allSelected ? 'checked' : ''}>`, 'check-cell')}${resizableHeader('id', 'ID')}${resizableHeader('source', panelText('源节点', 'Source'))}${resizableHeader('target', panelText('目标节点', 'Target'))}${resizableHeader('relation', panelText('关系', 'Relation'))}${resizableHeader('strength', panelText('强度', 'Strength'))}</tr></thead>
        <tbody>${project.semanticLinks.map((link) => `<tr><td class="check-cell"><input type="checkbox" aria-label="${escapeHtml(`${panelText('选择', 'Select')} ${link.id}`)}" data-select-record="${escapeHtml(link.id)}" ${dataSelection.has(link.id) ? 'checked' : ''}></td><td class="mono">${escapeHtml(link.id)}</td><td>${editableCell(link.id, 'source', endpointId(link.source))}</td><td>${editableCell(link.id, 'target', endpointId(link.target))}</td><td><select aria-label="${escapeHtml(`${link.id} relation`)}" data-edit-id="${escapeHtml(link.id)}" data-edit-field="relation">${['support','oppose','related'].map((relation) => `<option value="${relation}" ${link.relation === relation ? 'selected' : ''}>${t(relation)}</option>`).join('')}</select></td><td>${editableCell(link.id, 'strength', link.strength, 'number')}</td></tr>`).join('')}</tbody>`}
    </table></div>`;
  bindColumnResizers();
  const nextScroll=dataView.querySelector('.data-table-wrap');
  nextScroll.scrollTop=scroll.top;nextScroll.scrollLeft=scroll.left;
  dataView.querySelectorAll('[data-entity]').forEach((button) => button.addEventListener('click', () => { dataEntity = button.dataset.entity; dataSelection.clear(); renderDataView(); }));
  dataView.querySelector('#select-all-data')?.addEventListener('change', (event) => {
    dataSelection = event.target.checked ? new Set(records.map((record) => record.id)) : new Set();
    renderDataView();
  });
  dataView.querySelectorAll('[data-select-record]').forEach((input) => input.addEventListener('change', (event) => {
    if (event.target.checked) dataSelection.add(event.target.dataset.selectRecord); else dataSelection.delete(event.target.dataset.selectRecord);
    renderDataView();
  }));
  dataView.querySelectorAll('[data-edit-id]').forEach((input) => input.addEventListener('change', (event) => {
    const list = dataEntity === 'nodes' ? nodes : project.semanticLinks;
    const record = list.find((item) => item.id === event.target.dataset.editId);
    if (!record) return;
    const field = event.target.dataset.editField;
    record[field] = event.target.type === 'checkbox' ? event.target.checked : event.target.type === 'number' ? Number(event.target.value) : event.target.value;
    toast(panelText('修改已保存', 'Changes saved'));
  }));
  dataView.querySelector('#delete-data-button')?.addEventListener('click', async () => {
    if(dataEntity==='nodes'){await deletePaperNodes([...dataSelection]);return;}
    if (!dataSelection.size || !window.confirm(panelText(`确定删除 ${dataSelection.size} 项？此操作会同时移除关联关系。`, `Delete ${dataSelection.size} items? Connected edges will also be removed.`))) return;
    if (dataEntity === 'nodes') {
      const removed = new Set(dataSelection);
      nodes = nodes.filter((node) => !removed.has(node.id));
      project.nodes = project.nodes.filter((node) => !removed.has(node.id));
      project.semanticLinks = project.semanticLinks.filter((link) => !removed.has(endpointId(link.source)) && !removed.has(endpointId(link.target)));
      project.citationLinks = project.citationLinks.filter((link) => !removed.has(endpointId(link.source)) && !removed.has(endpointId(link.target)));
    } else {
      project.semanticLinks = project.semanticLinks.filter((link) => !dataSelection.has(link.id));
    }
    dataSelection.clear();
    saveCurrentProject();
    renderDataView();
    updateCounters();
  });
}

function setView(nextView) {
  if (view === nextView) return;
  clearCurrentNodeSelection();
  const previousView = view;
  if (['semantic', 'timeline'].includes(previousView)) {
    if (renderMode === '3d') save3dCameraState();
    else if (usesSemanticLayout()) saveVectorState(previousView);
    else saveGraphState(previousView);
    viewRenderModes[previousView] = renderMode;
    viewLayoutBases[previousView] = layoutBasis;
  }
  view = nextView;
  graphLocked = false;
  updateModeButtons();
  document.querySelectorAll('[data-view]').forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelector('#graph-stage').classList.toggle('data-mode', view === 'table');
  updateSidebarAvailability();
  if (view === 'table') {
    document.querySelector('#graph-3d-keys').hidden = true;
    simulation.stop();
    graph3d?.pauseAnimation();
    activePanel = null;
    renderSecondaryPanel();
    renderOverview();
    renderDataView();
    return;
  }
  dataView.hidden = true;
  graphView = view;
  renderMode = viewRenderModes[view] || '2d';
  layoutBasis = viewLayoutBases[view] || 'argument';
  updateGraphLegend();
  const hasSavedCamera = usesSemanticLayout() ? Boolean(vectorCameras[view]) : Boolean(viewCameras[view]);
  canvas.hidden = renderMode === '3d';
  graph3dHost.hidden = renderMode !== '3d';
  if (renderMode === '3d') {
    simulation.stop();
    graph3dDataKey = '';
    if (usesSemanticLayout()) buildVectorLinks();
    void renderGraph3D(true);
  } else {
    if (usesSemanticLayout()) {
      buildVectorLinks();
      loadVectorPositions(view);
    } else {
      loadGraphState(view);
    }
    configureSimulation(true);
    if (!hasSavedCamera) {
      settleSemantic2DLayout();
      fitView(0);
      if (usesSemanticLayout()) saveVectorState(view); else saveGraphState(view);
    }
  }
  renderOverview();
  renderSecondaryPanel();
  render();
}

function updateSidebarAvailability() {
  const dataMode = view === 'table';
  const displayToggle = document.querySelector('#display-toggle');
  const displaySubmenu = document.querySelector('#display-submenu');
  displayToggle.disabled = dataMode;
  document.querySelectorAll('#display-submenu [data-panel], [data-panel="filters"], [data-panel="statistics"]').forEach((button) => {
    button.disabled = dataMode;
  });
  if (dataMode) {
    displayToggle.setAttribute('aria-expanded', 'false');
    displaySubmenu.setAttribute('aria-hidden', 'true');
    displaySubmenu.setAttribute('inert', '');
    displaySubmenu.classList.remove('expanded');
  }
}

function rebuildProcessedGraph() {
  // Classification and verified relationships now determine positions for every paper.
  nodes.forEach(node=>{node.fx=null;node.fy=null;node.fz=null;node.viewPositions={};});
  graphLocked=false;
  vectorCameras.semantic=null;vectorCameras.timeline=null;
  Object.values(graph3dCameraStates).forEach(states=>{states.argument=null;states.semantic=null;});
  Object.values(graph3dInitialized).forEach(states=>{states.argument=false;states.semantic=false;});
  graph3dDataKey='';
  rebuildMetadataCitationLinks();
  buildVectorLinks();
  if(usesSemanticLayout())loadVectorPositions(view==='table'?graphView:view);
  else {initializePositions();if(view==='timeline')loadGraphState('timeline');}
  updateModeButtons();
  configureSimulation();
  if(renderMode==='3d' && view!=='table')void renderGraph3D(true);
  else if(view!=='table'){
    simulation.stop();simulation.tick(Math.max(30,Math.min(90,Math.round(12000/Math.max(1,nodes.length)))));
    theory2dFraming.semantic=null;theory2dFraming.timeline=null;
    fitView(0);
    if(usesSemanticLayout())saveVectorState(view);else saveGraphState(view);
    render();
  }
}
function resetLayout() {
  if (usesSemanticLayout()) {
    const positionKey = vectorPositionKey(view);
    nodes.forEach((node) => { if (node.viewPositions) delete node.viewPositions[positionKey]; });
    vectorCameras[view] = null;
    buildVectorLinks();
    loadVectorPositions(view);
  } else if (view === 'semantic') initializePositions();
  else {
    nodes.forEach((node) => {
      const anchor = clusterPoint(node);
      node.x = anchor.x * 0.7;
      node.y = yearPosition(publicationValue(node));
      node.vx = 0;
      node.vy = 0;
      node.fx = null;
      node.fy = node.y;
    });
  }
  graphLocked = false;
  updateModeButtons();
  if (renderMode === '3d') {
    graph3dCameraStates[view][layoutBasis] = null;
    graph3dInitialized[view][layoutBasis] = false;
    graph3dDataKey = '';
    void renderGraph3D(true);
  } else {
    configureSimulation();
  }
  toast(panelText('已解除全部固定位置并重新计算布局', 'All positions unpinned and layout recalculated'));
}

function confirmPaperDeletion(count) {
  return new Promise(resolve=>{
    const backdrop=document.createElement('div');backdrop.className='modal-backdrop delete-confirm-backdrop';
    const previous=document.activeElement;
    backdrop.innerHTML=`<section class="settings-dialog delete-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-confirm-title"><h2 id="delete-confirm-title">${panelText(`删除 ${count} 篇文献？`,`Delete ${count} papers?`)}</h2><p>${panelText('将移除所选节点及其连线，已保存的原文文件保留。','Selected nodes and their connections will be removed. Saved original files are retained.')}</p><footer><button type="button" data-delete-cancel>${panelText('取消','Cancel')}</button><button type="button" data-delete-confirm>${panelText('确认删除','Confirm delete')}</button></footer></section>`;
    const finish=value=>{backdrop.remove();previous?.isConnected&&previous.focus();resolve(value);};
    backdrop.querySelector('[data-delete-cancel]').onclick=()=>finish(false);
    backdrop.querySelector('[data-delete-confirm]').onclick=()=>finish(true);
    backdrop.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false);}
      if(event.key==='Tab'){event.preventDefault();const buttons=[...backdrop.querySelectorAll('button')];buttons[(buttons.indexOf(document.activeElement)+1)%2].focus();}
    });
    document.body.append(backdrop);backdrop.querySelector('[data-delete-cancel]').focus();
  });
}
async function deletePaperNodes(ids) {
  const projectId=currentProjectId;
  const removed=new Set(ids.filter(id=>nodes.some(n=>n.id===id)));
  if(!removed.size || removed.size>1 && !await confirmPaperDeletion(removed.size))return;
  if(currentProjectId!==projectId)return;

  for (const [nodeId, controller] of activePaperTasks) if (removed.has(nodeId)) controller.abort();
  nodes=nodes.filter(n=>!removed.has(n.id));project.nodes=nodes;
  for(const key of ['semanticLinks','citationLinks'])project[key]=project[key].filter(e=>!removed.has(endpointId(e.source))&&!removed.has(endpointId(e.target)));
  for(const id of removed){pendingOriginalFiles.delete(id);selectedNodes.delete(id);searchNodes.delete(id);dataSelection.delete(id);}
  if(removed.has(selectedNode?.id))selectedNode=null;
  for(const job of discoveryHistory.filter(j=>j.projectId===projectId)){
    const before=job.items.length;job.items=job.items.filter(item=>!removed.has(item.nodeId));
    if(before!==job.items.length){job.removed=(job.removed||0)+before-job.items.length;if(job.items.every(i=>i.stage==='done'))job.status='done';}
  }
  tooltip.classList.remove('show');hoveredNode=null;projectIsBlank=!nodes.length;
  buildVectorLinks();configureSimulation();graph3dDataKey='';
  updateResearchEntry();renderOverview();renderOverviewState();if(view==='table')renderDataView();render();
  saveCurrentProject();persistDiscoveryHistory();updateAddPapersButton();renderLiteratureDiscoveryWindow();
  await localRequest('project',{projectId,project:cleanProjectForExport()}).catch(error=>toast(localizedError(error,language)));
  toast(panelText(`已删除 ${removed.size} 篇文献，原文文件已保留。`,`Deleted ${removed.size} papers. Original files retained.`));
}
function clearCurrentNodeSelection() {
  selectedNode = null;
  selectedNodes.clear();
  hoveredNode = null;
  tooltip.classList.remove('show');
  updateResearchEntry();
  renderOverview();
}

function clearSelection() {
  clearCurrentNodeSelection();
  searchNodes.clear();
  searchInput.value = '';
  render();
}

function applyLanguage() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  localStorage.setItem('litgraph.language', language);
  translateStaticUI(language);
  updateWindowControl();
  const keyVisible = document.querySelector('#api-key').type === 'text';
  const keyToggle = document.querySelector('#toggle-api-key');
  keyToggle.textContent = keyVisible ? panelText('隐藏', 'Hide') : panelText('显示', 'Show');
  keyToggle.setAttribute('aria-label', keyVisible ? panelText('隐藏 API Key', 'Hide API key') : panelText('显示 API Key', 'Show API key'));
  const testButton = document.querySelector('#test-api-button');
  testButton.textContent = testButton.disabled ? panelText('正在测试…', 'Testing…') : panelText('测试并保存', 'Test & save');
  tooltip.classList.remove('show');
  contextHelpTooltip.hidden = true;
  document.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelector('#language-label').textContent = '中 / EN';
  updateResearchEntry();
  searchInput.placeholder = t('search');
  document.querySelector('#language-button').setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换到中文');
  const toolLabels = {
    'edit-mode-button': 'edit',
    'lock-button': 'lock', 'multi-select-button': 'multi', 'box-select-button': 'box',
    'zoom-in-button': 'zoomIn', 'zoom-out-button': 'zoomOut', 'canvas-fit-button': 'fit', 'fullscreen-button': 'fullscreen'
  };
  Object.entries(toolLabels).forEach(([id, key]) => {
    const button = document.querySelector(`#${id}`);
    button.title = t(key);
    button.setAttribute('aria-label', t(key));
  });
  renderSecondaryPanel();
  renderProjectSelectorMenu();
  renderStagedPaperFiles();
  updateAddPapersButton();
  document.querySelector('#toast').classList.remove('show');
  renderResearchDesk();
  const institutionDraft = discoveryWindow?.querySelector('#discovery-institution-url')?.value;
  if (institutionDraft !== undefined) discoveryInstitutionUrl = institutionDraft;
  renderLiteratureDiscoveryWindow();
  document.querySelector('#theme-button').setAttribute('aria-label', theme === 'dark' ? panelText('切换到日间模式', 'Switch to light mode') : panelText('切换到夜间模式', 'Switch to dark mode'));
  if (view === 'table') renderDataView(); else render();
  if (selectedNode) renderInspector(selectedNode);
  updateModelBadge();
}

function applyTheme(nextTheme, resetBackground = true) {
  theme = nextTheme;
  if (resetBackground) {
    canvasBackground = nextTheme === 'dark' ? 'dark' : 'light';
    localStorage.setItem('litgraph.canvasBackground', canvasBackground);
  }
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#292b2e' : '#ffffff');
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme === 'dark' ? 'dark' : 'light');
  const button = document.querySelector('#theme-button');
  button.setAttribute('aria-pressed', String(theme === 'dark'));
  button.setAttribute('aria-label', theme === 'dark' ? panelText('切换到日间模式', 'Switch to light mode') : panelText('切换到夜间模式', 'Switch to dark mode'));
  if (activePanel === 'background') renderSecondaryPanel();
  render();
}

function updateModeButtons() {
  const states = {
    'edit-mode-button': editMode,
    'lock-button': graphLocked,
    'multi-select-button': interactionMode === 'multi',
    'box-select-button': interactionMode === 'box',
    'fullscreen-button': fullscreenCanvas
  };
  Object.entries(states).forEach(([id, active]) => {
    const button = document.querySelector(`#${id}`);
    if (!button) return;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function toggleEditMode() {
  editMode = !editMode;
  interactionMode = null;
  nodeEditPopover.hidden = true;
  canvas.classList.toggle('edit-mode', editMode);
  updateModeButtons();
  toast(editMode ? panelText('重命名模式已开启：单击论文修改名称', 'Rename mode on: click a paper to rename it') : panelText('重命名模式已关闭', 'Rename mode off'));
  render();
}

function showNodeEditor(node, position) {
  editingNode = node;
  document.querySelector('#node-label-input').value = node.language === 'en' ? (node.claimLabelEn || node.claimLabel) : node.claimLabel;
  nodeEditPopover.style.left = `${Math.min(width - 230, position.x + 12)}px`;
  nodeEditPopover.style.top = `${Math.min(height - 100, position.y + 12)}px`;
  nodeEditPopover.hidden = false;
  document.querySelector('#node-label-input').focus();
}

function toggleGraphLock() {
  graphLocked = !graphLocked;
  nodes.forEach((node) => {
    if (graphLocked) {
      node.fx = node.x;
      node.fy = node.y;
    } else if (view === 'timeline') {
      node.fx = null;
      node.fy = yearPosition(publicationValue(node));
    } else {
      node.fx = null;
      node.fy = null;
    }
  });
  simulation.alphaTarget(0);
  if (!graphLocked) simulation.alpha(0.45).restart();
  updateModeButtons();
  toast(graphLocked ? panelText('已锁定全部节点位置', 'All node positions locked') : panelText('已解除位置锁定', 'Node positions unlocked'));
}

function setInteractionMode(mode) {
  const exitsSelectionMode = interactionMode === mode && (mode === 'multi' || mode === 'box');
  interactionMode = interactionMode === mode ? null : mode;
  selectionRect = null;
  selectionBox.classList.remove('show');
  canvas.classList.toggle('selection-mode', Boolean(interactionMode));
  if (exitsSelectionMode) clearSelection();
  updateModeButtons();
}

async function toggleCanvasFullscreen() {
  fullscreenCanvas = !fullscreenCanvas;
  document.querySelector('.app-shell').classList.toggle('canvas-only', fullscreenCanvas);
  if (fullscreenCanvas && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen().catch(() => {});
  if (!fullscreenCanvas && document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  updateModeButtons();
  window.setTimeout(resizeCanvas, 80);
}

function syncGraph3dResolution() {
  if (!graph3d) return;
  const renderer = graph3d.renderer();
  const rect = graph3dHost.getBoundingClientRect();
  // The graph library's hit testing uses viewport pixels, not CSS-zoom layout
  // pixels. Keep its camera/renderer size in that same coordinate system.
  graph3d.width(rect.width).height(rect.height);
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
  const composer = graph3d.postProcessingComposer?.();
  // EffectComposer keeps its own ratio: changing only the renderer stretches a
  // low-resolution offscreen image over a high-resolution display canvas.
  const resolutionKey = `${rect.width}:${rect.height}:${ratio}`;
  if (graph3dHost.dataset.resolutionKey !== resolutionKey) {
    composer?.setPixelRatio(ratio);
    composer?.setSize(rect.width, rect.height);
    for (const target of [composer?.renderTarget1, composer?.renderTarget2]) {
      if (target && target.samples !== 4) { target.samples = 4; target.dispose(); }
    }
    graph3dHost.dataset.resolutionKey = resolutionKey;
  }
  renderer.domElement.dataset.pixelRatio = String(ratio);
  renderer.domElement.dataset.offscreenWidth = String(composer?.renderTarget1?.width || renderer.domElement.width);
}

function resizeCanvas() {
  const graphStage = document.querySelector('#graph-stage');
  width = Math.max(320, graphStage.clientWidth);
  height = Math.max(320, graphStage.clientHeight);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const renderedStageWidth = graphStage.getBoundingClientRect().width || width;
  const applicationScale = Math.max(1, renderedStageWidth / Math.max(1, graphStage.clientWidth));
  deviceScale = Math.min(4, Math.max(1, (window.devicePixelRatio || 1) * applicationScale));
  canvas.width = Math.round(width * deviceScale);
  canvas.height = Math.round(height * deviceScale);
  canvas.dataset.pixelRatio = deviceScale.toFixed(3);
  if (renderMode === '3d' && graph3d) {
    syncGraph3dResolution();
  } else if (renderMode === '3d') renderGraph3D();
  else render();
}

function applyPanelWidths() {
  document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
  document.documentElement.style.setProperty('--inspector-width', `${inspectorWidth}px`);
  window.setTimeout(resizeCanvas, 0);
}

function bindInspectorResizer() {
  const handle = document.querySelector('#inspector-resizer');
  if (!handle) return;
  handle.addEventListener('pointerdown', (event) => {
    const startX = event.clientX;
    const startWidth = inspectorWidth;
    const move = (moveEvent) => {
      inspectorWidth = Math.max(300, Math.min(560, startWidth + (startX - moveEvent.clientX) / PAGE_SCALE));
      applyPanelWidths();
    };
    const end = () => {
      localStorage.setItem('litgraph.inspectorWidth', String(inspectorWidth));
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  });
}

function bindSidebarResizer() {
  const handle = document.querySelector('#sidebar-resizer');
  handle.addEventListener('pointerdown', (event) => {
    const shell = document.querySelector('.app-shell');
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    shell.classList.add('sidebar-resizing');
    handle.classList.add('dragging');
    const move = (moveEvent) => {
      sidebarWidth = Math.max(190, Math.min(340, startWidth + (moveEvent.clientX - startX) / PAGE_SCALE));
      applyPanelWidths();
    };
    const end = () => {
      localStorage.setItem('litgraph.sidebarWidth', String(sidebarWidth));
      shell.classList.remove('sidebar-resizing');
      handle.classList.remove('dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', end);
  });
}

function showTooltip(node, position, positionOnly = false) {
  if (!node) {
    tooltip.classList.remove('show');
    return;
  }
  if (!positionOnly) {
  const theory = theoryById(node.primaryTheory);
  const theoryLabel = language === 'en' ? (theory.labelEn || theory.label) : theory.label;
  const authors = (node.authors || []).join(', ') || panelText('作者未知', 'Unknown author');
  const journal = node.journal || panelText('期刊信息未收录', 'Journal not available');
  tooltip.innerHTML = `
    <div class="tooltip-kicker"><i style="background:${escapeHtml(theory.color || '#7c3eff')}"></i><span>${escapeHtml(theoryLabel)}</span><b>${escapeHtml(String(node.year || '—'))}</b></div>
    <strong>${escapeHtml(node.title)}</strong>
    <p>${escapeHtml(authors)}</p>
    <div class="tooltip-meta"><span>${escapeHtml(journal)}</span><span>${panelText('被引', 'Cited')} ${formatNumber(node.citations)}</span><span>${node.hasPdf ? panelText('已有全文', 'Full text ready') : panelText('缺少全文', 'No full text')}</span></div>`;
  tooltip.style.removeProperty('left');
  tooltip.style.removeProperty('top');
  tooltip.style.removeProperty('right');
  tooltip.style.removeProperty('bottom');
  }
  tooltip.classList.add('show');
  const margin = 10;
  const offset = 13;
  const width = tooltip.offsetWidth;
  const height = tooltip.offsetHeight;
  const anchorX = Number(position?.x) || 0;
  const anchorY = Number(position?.y) || 0;
  let left = anchorX + offset;
  let top = anchorY + offset;
  if (left + width > workspace.clientWidth - margin) left = anchorX - width - offset;
  if (top + height > workspace.clientHeight - margin) top = anchorY - height - offset;
  tooltip.style.left = `${Math.max(margin, Math.min(left, workspace.clientWidth - width - margin))}px`;
  tooltip.style.top = `${Math.max(margin, Math.min(top, workspace.clientHeight - height - margin))}px`;
}

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => element.classList.remove('show'), 2400);
}

function formatNumber(value) {
  if(value===null||value===undefined)return '—';
  return new Intl.NumberFormat('zh-CN').format(Number(value) || 0);
}

function search() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  if (!query) {
    searchNodes.clear();
    selectedNodes.clear();
    updateResearchEntry();
    render();
    return;
  }
  const matches = nodes.filter((item) => `${item.title} ${(item.authors || []).join(' ')} ${item.doi || ''} ${item.journal || ''} ${(item.keywords || []).join(' ')} ${item.claimLabel || ''} ${item.claimLabelEn || ''}`.toLocaleLowerCase().includes(query));
  if (!matches.length) return toast(panelText('没有找到匹配的论文', 'No matching papers'));
  matches.forEach((node) => enabledTheories.add(node.primaryTheory));
  searchNodes = new Set(matches.map((node) => node.id));
  selectedNodes = new Set(matches.map((node) => node.id));
  selectedNode = matches.length === 1 ? matches[0] : null;
  updateResearchEntry();
  renderFilters();
  configureSimulation(false);
  if (matches.length === 1) {
    renderInspector(matches[0]);
    centerNode(matches[0]);
  } else {
    renderOverview();
    window.setTimeout(() => fitView(320), 30);
    toast(panelText(`找到 ${matches.length} 篇匹配论文，已同时高亮`, `${matches.length} matching papers highlighted`));
  }
}

function cleanProjectForExport() {
  return {
    meta: project.meta,
    theories: project.theories,
    nodes: nodes.map(({ x, y, vx, vy, fx, fy, index, ...node }) => node),
    semanticLinks: project.semanticLinks.map((link) => ({ ...link, source: endpointId(link.source), target: endpointId(link.target) })),
    citationLinks: project.citationLinks.map((link) => ({ ...link, source: endpointId(link.source), target: endpointId(link.target) }))
  };
}

function saveCurrentProject() {
  if (!project?.meta) return;
  project.meta.id = currentProjectId;
  projectLibrary[currentProjectId] = {
    id: currentProjectId,
    title: project.meta.title || panelText('未命名项目', 'Untitled project'),
    updatedAt: new Date().toISOString(),
    data: cleanProjectForExport()
  };
  try {
    localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(projectLibrary));
    localStorage.setItem(ACTIVE_PROJECT_KEY, currentProjectId);
  } catch {
    toast(panelText('项目内容较大，浏览器本地存储空间不足，请及时导出备份', 'Local browser storage is full. Export a backup of this project.'));
  }
  renderProjectSelectorMenu();
}

function renderProjectSelectorMenu() {
  const menu = document.querySelector('#project-selector-menu');
  if (!menu) return;
  const projects = Object.values(projectLibrary).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  menu.innerHTML = `<p>${panelText('已有项目', 'Projects')}</p>
    <div class="saved-project-list">${projects.map((entry) => `<button type="button" role="menuitem" data-project-id="${escapeHtml(entry.id)}" class="${entry.id === currentProjectId ? 'current' : ''}"><span>${escapeHtml(entry.title)}</span><i>${(entry.id === currentProjectId ? nodes : entry.data?.nodes || []).filter(n=>!n.importCanvasHidden).length} ${panelText('篇', 'papers')}</i></button>`).join('')}</div>
    <div class="project-menu-divider"></div>
    <button type="button" role="menuitem" data-project-action="new">${panelText('新建项目', 'New project')}</button>
    <button type="button" role="menuitem" data-project-action="rename">${panelText('重命名当前项目', 'Rename current project')}</button>
    <button class="danger" type="button" role="menuitem" data-project-action="delete">${panelText('删除当前项目', 'Delete current project')}</button>`;
}

function activateProjectData(candidate, id = candidate.meta?.id || `project-${Date.now()}`) {
  if(discoveryImporting || discoverySearching || receivingInstitution) return toast(panelText('请先暂停当前检索或等待原文接收完成，再切换项目。','Pause the search or wait for the original transfer before switching projects.'));
  discoveryResults=[];discoverySelected.clear();discoveryStep='search';activeDiscoveryJobId=null;filterState.journals=[];
  discoveryNotice='';discoveryProgress='';pendingInstitutionNode=null;expandedHistoryJobs.clear();
  validateImportedProject(candidate);
  leaveResearchProject();
  simulation.stop();
  project = refreshSampleNodes(JSON.parse(JSON.stringify(candidate)), sampleProjectSource);
  currentProjectId = id;
  project.meta ??= { title: panelText('导入的 LitGraph 项目', 'Imported LitGraph project'), mock: false };
  project.meta.id = id;
  nodes = project.nodes.map((node) => ({
    citations: 0, impact: 0.5, theoryStrength: node.impact ?? 0.5,
    claimLabel: node.title ?? panelText('未命名观点', 'Untitled claim'), hasPdf: false, evidence: '', summary: '', ...node,
    secondaryTheories: [...(node.secondaryTheories || [])], authors: [...(node.authors || [])], viewPositions: node.viewPositions || {}
  }));
  project.nodes = nodes;
  enabledTheories = new Set(project.theories.map((theory) => theory.id));
  selectedNode = null;
  selectedNodes.clear();
  hoveredNode = null;
  searchNodes.clear();
  viewCameras.semantic = null;
  viewCameras.timeline = null;
  vectorCameras.semantic = null;
  vectorCameras.timeline = null;
  viewRenderModes.semantic = '2d';
  viewRenderModes.timeline = '2d';
  viewLayoutBases.semantic = 'argument';
  viewLayoutBases.timeline = 'argument';
  Object.values(graph3dCameraStates).forEach((states) => { states.argument = null; states.semantic = null; });
  Object.values(graph3dInitialized).forEach((states) => { states.argument = false; states.semantic = false; });
  theory2dFraming.semantic = theory2dFraming.timeline = null;
  renderMode = '2d';
  layoutBasis = 'argument';
  canvas.hidden = false;
  graph3dHost.hidden = true;
  initializePositions();
  renderFilters();
  configureSimulation();
  renderOverview();
  renderOverviewState();
  document.querySelector('#project-selector-label').textContent = project.meta.title;
  saveCurrentProject();
  renderLiteratureDiscoveryWindow();renderPaperImportHistory();
  const initialProjectId=currentProjectId;
  void repairProjectSourceMetadata();
  window.setTimeout(() => {
    // A deferred 2D project fit must never override a 3D camera selected meanwhile.
    if(currentProjectId===initialProjectId && renderMode==='2d')fitView(420);
  }, 500);
}

function exportProject() {
  const blob = new Blob([JSON.stringify(cleanProjectForExport(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'litgraph-demo-project.json';
  anchor.click();
  URL.revokeObjectURL(url);
  toast(panelText('项目 JSON 已导出，可交给 AI Agent 修改', 'Project JSON exported for editing by an AI agent'));
}

function validateImportedProject(candidate) {
  if (!candidate || !Array.isArray(candidate.nodes) || !Array.isArray(candidate.semanticLinks) || !Array.isArray(candidate.citationLinks)) {
    throw new Error(panelText('JSON 必须包含 nodes、semanticLinks 和 citationLinks 数组', 'JSON must contain nodes, semanticLinks and citationLinks arrays'));
  }
  if (!Array.isArray(candidate.theories) || candidate.theories.length < 1) {
    throw new Error(panelText('theories 至少需要包含一个理论类别', 'theories must contain at least one theory category'));
  }
  const ids = new Set(candidate.nodes.map((node) => node.id));
  [...candidate.semanticLinks, ...candidate.citationLinks].forEach((link) => {
    if (!ids.has(endpointId(link.source)) || !ids.has(endpointId(link.target))) throw new Error(panelText('存在指向未知论文的关系', 'An edge references an unknown paper'));
  });
}

async function importProject(file) {
  try {
    const candidate = JSON.parse(await file.text());
    saveCurrentProject();
    const importedId = `imported-${Date.now()}`;
    candidate.meta ??= { title: '导入的 LitGraph 项目', mock: false };
    candidate.meta.id = importedId;
    activateProjectData(candidate, importedId);
    toast(panelText(`已导入 ${nodes.length} 篇论文`, `Imported ${nodes.length} papers`));
  } catch (error) {
    toast(error instanceof Error ? error.message : panelText('无法读取该 JSON', 'Cannot read this JSON'));
  }
}

function createBlankProject({ savePrevious = true } = {}) {
  if(discoveryImporting || discoverySearching || receivingInstitution) return toast(panelText('请先暂停当前检索或等待原文接收完成，再新建项目。','Pause the search or wait for the original transfer before creating a project.'));
  discoveryResults=[];discoverySelected.clear();discoveryStep='search';activeDiscoveryJobId=null;filterState.journals=[];
  discoveryNotice='';discoveryProgress='';pendingInstitutionNode=null;expandedHistoryJobs.clear();
  if (savePrevious) saveCurrentProject();
  leaveResearchProject();
  simulation.stop();
  currentProjectId = `project-${Date.now()}`;
  project = {
    meta: { id: currentProjectId, schemaVersion: '0.2', title: panelText('未命名文献项目', 'Untitled literature project'), mock: false },
    theories: [{ id: 'unclassified', label: '待分类', labelEn: 'Unclassified', color: '#5d7185' }],
    nodes: [], semanticLinks: [], citationLinks: []
  };
  nodes = project.nodes;
  activeLinks = [];
  enabledTheories = new Set(['unclassified']);
  enabledRelations = new Set(['support', 'oppose', 'related']);
  selectedNode = null;
  selectedNodes.clear();
  searchNodes.clear();
  hoveredNode = null;
  projectIsBlank = true;
  viewCameras.semantic = null;
  viewCameras.timeline = null;
  vectorCameras.semantic = null;
  vectorCameras.timeline = null;
  viewRenderModes.semantic = '2d';
  viewRenderModes.timeline = '2d';
  viewLayoutBases.semantic = 'argument';
  viewLayoutBases.timeline = 'argument';
  Object.values(graph3dCameraStates).forEach((states) => { states.argument = null; states.semantic = null; });
  Object.values(graph3dInitialized).forEach((states) => { states.argument = false; states.semantic = false; });
  theory2dFraming.semantic = theory2dFraming.timeline = null;
  renderMode = '2d';
  layoutBasis = 'argument';
  view = 'semantic';
  graphView = 'semantic';
  camera = { x: width / 2, y: height / 2, k: 1 };
  document.querySelectorAll('[data-view]').forEach((button) => {
    const active = button.dataset.view === 'semantic';
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelector('#graph-stage').classList.remove('data-mode');
  dataView.hidden = true;
  renderOverview();
  renderOverviewState();
  render();
  document.querySelector('#project-selector-label').textContent = project.meta.title;
  saveCurrentProject();
  toast(panelText('已创建空白本地项目', 'Blank local project created'));
  renderLiteratureDiscoveryWindow();renderPaperImportHistory();
}

function renderOverviewState() {
  emptyCanvas.hidden = nodes.length > 0 || view === 'table';
  document.querySelector('#project-title').textContent = project.meta.title;
  updateCounters();
}

function safeJsonFromModel(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

const OPENALEX_WORK_FIELDS = 'id,doi,title,publication_year,cited_by_count,authorships,referenced_works,abstract_inverted_index,primary_location,best_oa_location,type,language';

function normalizedDoi(value = '') {
  return cleanDoi(value);
}

function openAlexAbstract(index) {
  if (!index || typeof index !== 'object') return '';
  const words = [];
  Object.entries(index).forEach(([word, positions]) => (positions || []).forEach((position) => { words[position] = word; }));
  return words.filter(Boolean).join(' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

function scholarlyMetadataFromWork(work) {
  const authors = (work?.authorships || []).map((item) => String(item?.author?.display_name || '').trim()).filter(Boolean);
  const doi = normalizedDoi(work?.doi);
  const landingPage = work?.primary_location?.landing_page_url || (doi ? `https://doi.org/${doi}` : work?.id || '');
  return {
    openAlexId: work?.id || '',
    doi,
    title: work?.title || '',
    year: Number(work?.publication_year) || null,
    authors,
    references: [...new Set((work?.referenced_works || []).filter(Boolean))],
    abstract: openAlexAbstract(work?.abstract_inverted_index),
    citations: typeof work?.cited_by_count==='number'?work.cited_by_count:null,
    journal: work?.primary_location?.source?.display_name || '',
    articleType: work?.type || 'article',
    language: String(work?.language || '').toLowerCase(),
    sourceUrl: landingPage,
    pdfUrl: work?.best_oa_location?.pdf_url || work?.primary_location?.pdf_url || ''
  };
}

async function fetchOpenAlexJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`OpenAlex ${response.status}`);
  return response.json();
}

async function lookupScholarlyMetadata({ doi = '', title = '' }) {
  const cleanedDoi = normalizedDoi(doi);
  if (cleanedDoi) {
    try {
      const work = await fetchOpenAlexJson(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanedDoi)}?select=${OPENALEX_WORK_FIELDS}`);
      if (work?.id) return scholarlyMetadataFromWork(work);
    } catch {}
  }
  if (!title.trim()) return null;
  try {
    const payload = await fetchOpenAlexJson(`https://api.openalex.org/works?search=${encodeURIComponent(title.trim())}&per-page=1&select=${OPENALEX_WORK_FIELDS}`);
    return payload?.results?.[0] ? scholarlyMetadataFromWork(payload.results[0]) : null;
  } catch {
    return null;
  }
}

function applyScholarlyMetadata(node, metadata) {
  if (!metadata) return node;
  if (metadata.title) node.title = metadata.title;
  if (metadata.year) node.year = metadata.year;
  if (metadata.language && metadata.language!=='unknown') node.language = metadata.language;
  if (metadata.authors?.length) node.authors = metadata.authors;
  if (metadata.doi) node.doi = metadata.doi;
  if (metadata.abstract) {
    node.abstract = metadata.abstract;
    node.abstractSource = metadata.abstractSource || metadata.metadataSource || 'OpenAlex';
    node.abstractRetrievedAt = new Date().toISOString().slice(0, 10);
  }
  node.openAlexId = metadata.openAlexId || node.openAlexId;
  node.metadataSource = metadata.metadataSource || (metadata.openAlexId ? 'OpenAlex' : '');
  node.metadataSources = metadata.metadataSources || (node.metadataSource ? [node.metadataSource] : []);
  node.referenceOpenAlexIds = metadata.references;
  node.referenceDois = metadata.referenceDois || [];
  node.referenceRecords = metadata.referenceRecords || [];
  node.citationSource = metadata.citationSource || metadata.metadataSource || '';
  node.citationRetrievedAt = metadata.citationRetrievedAt || null;
  node.metadataRetrievedAt = metadata.metadataRetrievedAt || null;
  node.metadataApiUrl = metadata.metadataApiUrl || '';
  node.volume = metadata.volume || node.volume || '';
  node.issue = metadata.issue || node.issue || '';
  node.pages = metadata.pages || node.pages || '';
  node.isOpenAccess = metadata.isOpenAccess === true;
  node.citations = metadata.citations;
  node.journal = metadata.journal || node.journal;
  node.articleType = metadata.articleType || node.articleType;
  node.sourceUrl = metadata.sourceUrl || node.sourceUrl;
  node.url = metadata.sourceUrl || node.url;
  node.pdfUrl = metadata.pdfUrl || node.pdfUrl;
  node.hasPdf = Boolean(node.originalRelativePath || node.localFileUrl || (node.hasPdf && node.fulltextStorageKey));
  return node;
}

function rebuildMetadataCitationLinks() {
  const byOpenAlexId = new Map(nodes.filter((node) => node.openAlexId).map((node) => [node.openAlexId, node]));
  const links = new Map((project.citationLinks || []).map((link) => [`${endpointId(link.source)}|${endpointId(link.target)}`, link]));
  const byDoi=new Map(nodes.filter(n=>n.doi).map(n=>[normalizedDoi(n.doi).toLowerCase(),n]));
  for(const source of nodes)for(const doi of source.referenceDois||[]){const target=byDoi.get(normalizedDoi(doi).toLowerCase());if(target&&source.id!==target.id)links.set(`${source.id}|${target.id}`,{id:`citation-${source.id}-${target.id}`,source:source.id,target:target.id,relation:'citation',strength:2,sourceType:'Source reference DOI'});}
  nodes.forEach((source) => (source.referenceOpenAlexIds || []).forEach((referenceId) => {
    const target = byOpenAlexId.get(referenceId);
    if (!target || target.id === source.id) return;
    const key = `${source.id}|${target.id}`;
    links.set(key, { id: `citation-${source.id}-${target.id}`, source: source.id, target: target.id, relation: 'citation', strength: 2, sourceType: 'OpenAlex referenced_works' });
  }));
  project.citationLinks = [...links.values()];
}


function nodeFromScholarlyMetadata(metadata, index) {
  const id = `openalex-${String(metadata.openAlexId || Date.now()).split('/').pop()}-${index}`;
  const ordinal = nodes.length + index;
  const angle = ordinal * 2.3999632297;
  const x = Math.cos(angle) * (45 + ordinal * 4);
  const y = Math.sin(angle) * (45 + ordinal * 4);
  return applyScholarlyMetadata({
    id, title: metadata.title || panelText('未命名论文', 'Untitled paper'), authors: [],
    year: metadata.year || null, month: 6,
    language: metadata.language || (/[\u3400-\u9fff]/.test(metadata.title || '') ? 'zh' : 'en'),
    primaryTheory: 'unclassified', secondaryTheories: [], citations: 0, impact: 0,
    theoryStrength: .55, claimLabel: metadata.title || '', claimLabelEn: metadata.title || '',
    keywords: [], journal: '', field: 'Unclassified', articleType: 'Research article',
    hasPdf: false, doi: '', url: '', pdfUrl: '', localFileUrl: '',
    abstract: panelText('学术数据源暂未收录摘要。', 'No abstract is currently available from the scholarly source.'),
    summary: panelText('等待生成项目内总结。', 'Awaiting a project summary.'),
    detailedResults: { question: '', method: '', conclusion: '', metrics: [] },
    isMock: false, read: false, x, y, fx: x, fy: y,
    viewPositions: { semantic: { x, y, fx: x, fy: y } }
  }, metadata);
}

function discoveryResultKey(metadata, index = 0) {
  return metadata.openAlexId || metadata.doi || `${metadata.title}-${index}`;
}

function closeLiteratureDiscoveryWindow() {
  discoveryWindow?.disposeWindow?.();
  discoveryWindow?.remove();
  discoveryWindow = null;
  document.querySelector('[data-panel="literature-discovery"]')?.classList.remove('active');
}

function discoveryOption(label, group, value, current) {
  const beta=group==='source'&&['combined','institution'].includes(value);
  return `<button class="discovery-choice ${current === value ? 'active' : ''} ${beta?'discovery-source-beta':''}" type="button" data-discovery-filter="${group}" data-discovery-value="${value}" aria-pressed="${current === value}">${label}${beta?`<sup class="discovery-beta" title="${panelText('测试中','In testing')}" aria-label="${panelText('测试中','In testing')}">beta</sup>`:''}</button>`;
}

function discoveryResultMarkup(metadata, index) {
  const key = discoveryResultKey(metadata, index);
  const checked = discoverySelected.has(key);
  const authorLine = compactAuthorLabel(metadata.authors || []);
  const type = String(metadata.articleType || 'article').replaceAll('-', ' ');
  return `<article class="discovery-result-card ${checked ? 'selected' : ''}">
    <label class="discovery-check"><input type="checkbox" data-discovery-result="${escapeHtml(key)}" ${checked ? 'checked' : ''}><span aria-hidden="true">✓</span></label>
    <span class="discovery-result-index">${index + 1}</span>
    <div class="discovery-result-copy">
      <strong>${escapeHtml(metadata.title || panelText('未命名论文', 'Untitled paper'))}</strong>
      <p>${escapeHtml(authorLine || panelText('作者信息待补充', 'Author data pending'))}<i>·</i>${escapeHtml(String(metadata.year || '—'))}<i>·</i>${escapeHtml(metadata.journal || panelText('期刊待确认', 'Journal pending'))}<i>·</i>${panelText('被引', 'Cited')} ${metadata.citations ?? '—'}</p>
      <div class="discovery-result-tags"><span>${escapeHtml(type)}</span><span>${escapeHtml(metadata.metadataSource||'')}</span>${metadata.doi ? '<span>DOI</span>' : ''}<span>${metadata.pdfUrl ? panelText('有开放全文地址，下载待验证','Open PDF link; download pending') : metadata.isOpenAccess?panelText('开放记录，全文待查找','Open record; locating PDF'):panelText('仅文献信息 / 需访问权限','Metadata only / access required')}</span><a href="${escapeHtml(metadata.sourceUrl)}" target="_blank" rel="noopener noreferrer">${panelText('查看来源', 'View source')}</a></div>
    </div>

  </article>`;
}

function bindDiscoveryDivider() {
  const body=discoveryWindow?.querySelector('.discovery-window-body'),divider=body?.querySelector('.discovery-divider');
  if(!divider)return;
  const apply=ratio=>{discoverySplit=Math.max(.25,Math.min(.65,ratio));body.style.setProperty('--discovery-left',`${discoverySplit*100}%`);divider.setAttribute('aria-valuenow',Math.round(discoverySplit*100));};
  apply(discoverySplit);
  divider.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.stopPropagation();event.preventDefault();divider.setPointerCapture(event.pointerId);divider.classList.add('dragging');});
  divider.addEventListener('pointermove',event=>{if(!divider.hasPointerCapture(event.pointerId))return;const rect=body.getBoundingClientRect();apply((event.clientX-rect.left)/rect.width);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])divider.addEventListener(name,event=>{divider.classList.remove('dragging');if(divider.hasPointerCapture(event.pointerId))divider.releasePointerCapture(event.pointerId);});
  divider.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;event.preventDefault();apply(event.key==='Home'?.4:discoverySplit+(event.key==='ArrowLeft'?-.02:.02));});
}
function historyMarkup() {
  const status = {searching:panelText('检索中','Searching'),ready:panelText('待导入','Ready to import'),running:panelText('处理中','Processing'),paused:panelText('已暂停','Paused'),attention:panelText('待补全','Needs attention'),error:panelText('未完成','Incomplete'),done:panelText('已完成','Complete')};
  const jobs=discoveryHistory.filter(j=>j.projectId===currentProjectId);
  const meter=(label,value,total)=>`<div class="history-meter"><span>${label}<b>${value}/${total}</b></span><progress max="${Math.max(1,total)}" value="${value}"></progress></div>`;
  return `<section class="discovery-history" aria-label="${panelText('检索与处理历史','Search and processing history')}"><div class="history-heading"><h3>${panelText('检索与处理历史','Search and processing history')}</h3><span>${panelText('按阶段保存，继续时跳过已完成步骤','Stages are saved; resume skips completed work')}</span></div>${jobs.length?jobs.map(job=>{
    const count=jobCounts(job),pages=job.items.find(i=>i.stage==='converting')?.pages;
    const open=expandedHistoryJobs.has(job.id);
    const detailItems=open?job.items:[];
    const title=job.kind==='local'?panelText(`本地文件导入（${job.found} 篇）`,`Local file import (${job.found})`):job.query;
    return `<article class="discovery-history-row">
      <div class="history-summary"><span class="history-summary-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(new Date(job.createdAt).toLocaleString(language==='en'?'en-GB':'zh-CN'))}</small></span><div class="history-summary-actions"><button type="button" data-history-delete="${escapeHtml(job.id)}" title="${panelText('仅删除记录，保留论文和文件；正在进行的处理不受影响。','Delete this record only; papers, files and ongoing processing are retained.')}">${panelText('删除该记录','Delete record')}</button><button type="button" data-history-resume="${escapeHtml(job.id)}" ${!count.total || count.completed===count.total || discoverySearching || discoveryImporting && job.id!==activeDiscoveryJobId?'disabled':''}>${count.total && count.completed===count.total?panelText('完成','Complete'):discoveryImporting && job.id===activeDiscoveryJobId?panelText('暂停','Pause'):panelText('继续','Continue')}</button><button type="button" data-history-redraw="${escapeHtml(job.id)}" ${!count.total||discoverySearching||discoveryImporting?'disabled':''} title="${panelText('隐藏本次导入中未分析的节点，保留文件和记录；继续处理时恢复。','Hide unanalyzed nodes from this import, retaining files and history. Continue restores them.')}">${panelText('重新绘制画布','Redraw canvas')}</button><button type="button" data-history-expand="${escapeHtml(job.id)}" aria-expanded="${open}">${open?panelText('收起','Collapse'):panelText('展开','Expand')}</button></div><span class="history-state">${escapeHtml(status[job.status]||job.status)}</span></div>
      <div class="history-row-progress">${meter(panelText('原文获取','Originals'),count.downloaded,count.total)}${meter(panelText('MD 转换','Markdown'),count.converted,count.downloaded)}${meter(panelText('分析','Analysis'),count.analyzed,count.converted)}</div>
      <div class="history-details" ${open?'':'hidden'}>${job.notice?`<p class="history-report">${escapeHtml(job.items.length?importJobReport(job):localizedError(job.notice,language))}</p>`:''}${pages?`<small>${panelText(`当前 PDF：${pages.done}/${pages.total} 页`,`Current PDF: ${pages.done}/${pages.total} pages`)}</small>`:''}${job.error?`<small class="history-error">${escapeHtml(localizedError(job.error,language))}</small>`:''}
      ${detailItems.map(i=>`<div class="history-paper-row"><span>${escapeHtml(i.title)}</span><small>${i.error?escapeHtml(localizedError(i.error,language)):i.stage==='done'?panelText('已完成','Complete'):panelText('处理中或待处理','Processing or pending')}</small>${i.rejectedRelationships?`<small>${escapeHtml(relationshipWarningText(i))}</small>`:''}${i.error?`<em>${panelText(`${i.downloaded?'原文已保留':'原文未获取，已跳过'}${i.converted?' · MD 已保留':''} · 可稍后继续`,`${i.downloaded?'Original retained':'Original unavailable; skipped'}${i.converted?' · MD retained':''} · Continue when ready`)}</em>`:''}${!i.downloaded&&job.projectId===currentProjectId?`<button type="button" class="institution-open-button" data-history-institution="${escapeHtml(i.nodeId)}">${panelText('通过机构获取','Get through institution')}</button>`:''}</div>`).join('')}
      ${job.results?.length?`<div class="history-row-actions"><button type="button" data-history-results="${escapeHtml(job.id)}" ${discoveryImporting||discoverySearching?'disabled':''}>${panelText('查看结果','View results')}</button></div>`:''}</div></article>`;
  }).join(''):`<p class="history-empty">${panelText('开始检索后，这里会自动记录每次检索及原文处理进度。','Each search and its original-processing progress will appear here.')}</p>`}</section>`;
}
function bindHistoryActions(host, rerender) {
  host.querySelectorAll('[data-history-redraw]').forEach(button=>button.addEventListener('click',async()=>{
    if(discoveryImporting || discoverySearching)return;
    const job=discoveryHistory.find(j=>j.id===button.dataset.historyRedraw&&j.projectId===currentProjectId);
    if(!job)return;
    setImportCanvasVisibility(nodes,job,true);
    for(const node of nodes)if(node.importCanvasHidden)selectedNodes.delete(node.id);
    if(selectedNode?.importCanvasHidden)selectedNode=null;
    rebuildProcessedGraph();saveCurrentProject();renderOverview();renderOverviewState();render();
    try {flushDesktopState();await localRequest('project',{projectId:currentProjectId,project:cleanProjectForExport()});}
    catch(error){toast(localizedError(error,language));return;}
    rerender();
    toast(panelText('画布已重绘；本次导入中未分析的节点已隐藏。文件和记录保留，点击继续即可恢复。','Canvas rebuilt. Unanalyzed nodes from this import are hidden; files and history are retained. Continue restores them.'));
  }));
  host.querySelectorAll('[data-history-delete]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.historyDelete;
    const job=discoveryHistory.find(j=>j.id===id&&j.projectId===currentProjectId);
    if(!job)return;
    // The running worker owns its job reference. Removing the history entry
    // must never cancel processing or remove project papers and their files.
    discoveryHistory=discoveryHistory.filter(j=>j!==job);
    expandedHistoryJobs.delete(id);
    persistDiscoveryHistory();
    rerender();
    toast(panelText('记录已删除，论文及文件已保留。','Record deleted; papers and files retained.'));
  }));
  host.querySelectorAll('[data-history-institution]').forEach(button=>button.addEventListener('click',()=>void openInstitutionWindow(nodes.find(n=>n.id===button.dataset.historyInstitution))));
  host.querySelectorAll('[data-history-expand]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.historyExpand;
    expandedHistoryJobs.has(id)?expandedHistoryJobs.delete(id):expandedHistoryJobs.add(id);
    rerender();
  }));
  host.querySelectorAll('[data-history-results]').forEach(button=>button.addEventListener('click',()=>{
    const job=discoveryHistory.find(j=>j.id===button.dataset.historyResults&&j.projectId===currentProjectId);
    if(job){showHistoricalResults(job);discoveryHistoryOpen=false;closeModal('paper-import');openLiteratureDiscoveryWindow();renderLiteratureDiscoveryWindow();}
  }));
  host.querySelectorAll('[data-history-resume]').forEach(button=>button.addEventListener('click',()=>{
    if(discoveryImporting){pauseActiveImport();return;}
    const job=discoveryHistory.find(j=>j.id===button.dataset.historyResume&&j.projectId===currentProjectId);
    if(job){showHistoricalResults(job);void runImportJob(job);}
  }));
}
let paperImportHistoryOpen=false,pendingInstitutionNode=null;

async function openInstitutionWindow(node=null,useSaved=true){
  let saved=null;try{saved=await desktop?.institution?.('saved');if(saved?.saved&&!discoveryInstitutionUrl)discoveryInstitutionUrl=saved.portalUrl||saved.url;}catch{}
  if(!discoveryInstitutionUrl){pendingInstitutionNode=node?{id:node.id,projectId:currentProjectId}:null;discoveryInstitutionOpen=true;openLiteratureDiscoveryWindow();renderLiteratureDiscoveryWindow();return;}
  if(!desktop?.institution){toast(panelText('软件内机构登录需要桌面安装版。网页预览请使用浏览器下载后导入。','In-app institution sign-in requires the desktop app. In web preview, download using your browser and import the file.'));return;}
  try{
    await desktop.institution('open',{portalUrl:discoveryInstitutionUrl,url:node?paperSource(node):discoveryInstitutionUrl,useSaved:useSaved&&!node,doi:node?.doi||'',title:node?.title||'',projectId:currentProjectId,projectTitle:project.meta.title,nodeId:node?.id||'',language});
  }
  catch(error){toast(panelText('无法打开机构窗口：','Could not open institution window: ')+localizedError(error,language));}
}
const institutionNotices=new Set();
const institutionAnalysisQueue=new Map();
async function receiveInstitutionDownloads(){
  if(!desktop?.institution||receivingInstitution||importProgress.processing)return;
  receivingInstitution=true;
  try{
    const receipts=await desktop.institution('list');
    // Never replace the source of a paper while its analysis is reading it.
    const receipt=receipts.find(r=>r.context.projectId===currentProjectId&&!activePaperTasks.has(r.context.nodeId));
    if(!receipt){
      const other=receipts.find(r=>r.context.projectId!==currentProjectId);
      if(other&&!institutionNotices.has(other.id)){institutionNotices.add(other.id);toast(panelText('机构 PDF 已保存，请切换回下载时的项目继续导入。','Institution PDF saved. Switch back to its project to continue importing.'));}
      if(!discoveryImporting&&!discoverySearching){
        const queued=[...institutionAnalysisQueue.values()].find(q=>q.projectId===currentProjectId);
        if(queued){institutionAnalysisQueue.delete(queued.nodeId);const job=discoveryHistory.find(j=>j.id===queued.jobId&&j.projectId===currentProjectId);if(job&&job.status!=='paused')await runImportJob(job,queued.nodeId);}
      }
      return;
    }
    await loadDiscoveryHistory();
    let node=nodes.find(n=>n.id===receipt.context.nodeId);
    if(!node && !window.confirm(panelText(`已下载「${receipt.fileName}」。导入当前项目并转换分析？`,`Downloaded “${receipt.fileName}”. Import into this project and process?`))){await desktop.institution('acknowledge',{id:receipt.id});return;}
    const projectId=currentProjectId;
    const {data}=await desktop.institution('read',{id:receipt.id});
    if(projectId!==currentProjectId)return;
    const file=new File([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],receipt.fileName,{type:'application/pdf'});
    if(!project.theories.some(t=>t.id==='unclassified'))project.theories.push({id:'unclassified',label:'待分类',labelEn:'Unclassified',color:'#7c6ca8'});
    enabledTheories.add('unclassified');
    const alreadyReceived=node?.institutionReceiptId===receipt.id;
    if(node&&!alreadyReceived){await saveOriginalFile(projectId,node,file);Object.assign(node,{fileName:file.name,analysisStatus:'pending',processingError:''});}
    else if(!node)node=await buildImportedNode(file,nodes.length);
    let job=discoveryHistory.find(j=>j.projectId===projectId&&j.items.some(i=>i.nodeId===node.id));
    if(!job){job=createImportJob(projectId,panelText('机构原文导入','Institution original import'),{source:'institution',institutionUrl:discoveryInstitutionUrl});job.kind='institution';job.status='ready';discoveryHistory.unshift(job);}
    const paused=job.status==='paused';
    let item=job.items.find(i=>i.nodeId===node.id);
    if(!item){item={nodeId:node.id,title:node.title};job.items.push(item);}
    if(!alreadyReceived)Object.assign(item,{downloaded:true,converted:false,analyzed:false,stage:'pending',error:''});
    syncPaperProgress(node,item);
    node.institutionReceiptId=receipt.id;project.nodes=nodes;project.meta.mock=false;projectIsBlank=false;
    saveCurrentProject();persistDiscoveryHistory();
    renderLiteratureDiscoveryWindow();renderPaperImportHistory();updateAddPapersButton();
    if(selectedNode?.id===node.id)renderInspector(node);
    await historyWrite;
    await localRequest('project',{projectId,project:cleanProjectForExport()});
    await desktop.institution('acknowledge',{id:receipt.id});
    configureSimulation(false);renderOverviewState();render();
    if(paused)toast(panelText('机构 PDF 已补充。任务保持暂停，可在历史记录中继续。','Institution PDF added. The task remains paused; continue from history.'));
    else if(item.stage!=='done'){
      if(discoveryImporting||discoverySearching)institutionAnalysisQueue.set(node.id,{nodeId:node.id,projectId,jobId:job.id});
      else await runImportJob(job,node.id);
    }
  }catch(error){const key='error:'+error.message;if(!institutionNotices.has(key)){institutionNotices.add(key);toast(panelText('机构原文接收未完成，文件仍保存在数据文件夹：','Institution transfer incomplete; the file remains in your data folder: ')+localizedError(error,language));}}
  finally{receivingInstitution=false;}
}
function renderPaperImportHistory() {
  const modal=document.querySelector('#paper-import-modal');
  const toggle=document.querySelector('#paper-import-history-toggle');
  toggle.setAttribute('aria-pressed',String(paperImportHistoryOpen));
  toggle.classList.toggle('processing',discoveryImporting || importProgress.processing);
  if(modal.hidden)return;
  const host=document.querySelector('#paper-import-history');
  modal.querySelector('.paper-import-body').hidden=paperImportHistoryOpen;
  modal.querySelector('.paper-import-dialog > footer').hidden=paperImportHistoryOpen;
  host.hidden=!paperImportHistoryOpen;
  if(paperImportHistoryOpen){const top=host.scrollTop;host.innerHTML=historyMarkup();bindHistoryActions(host,renderPaperImportHistory);host.scrollTop=top;}
}
let historyLoaded;
async function loadDiscoveryHistory() {
  historyLoaded ||= localRequest('discovery-history').then(({jobs})=>{
    for (const job of restoreJobs(JSON.stringify(jobs))) if (!discoveryHistory.some(j=>j.id===job.id)) discoveryHistory.push(job);
    discoveryHistory.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }).catch(()=>{});
  await historyLoaded;
}
function showHistoricalResults(job) {
  if(job.projectId!==currentProjectId)return;
  activeDiscoveryJobId=job.id;
  discoveryResults=job.results || [];
  discoverySelected=new Set();discoveryStep=discoveryResults.length?'results':'search';
  discoveryNotice=job.notice||'';
}
function renderLiteratureDiscoveryWindow() {
  if (!discoveryWindow?.isConnected) return;
  discoveryWindow.setAttribute('aria-label',panelText('文献发现','Literature discovery'));
  const scrollPositions=['.discovery-history','.discovery-conditions','.discovery-result-list'].map(selector=>[selector,discoveryWindow.querySelector(selector)?.scrollTop||0]);
  const resultCount = discoveryResults.length;
  const selectedCount = discoverySelected.size;
  const notice=activeImportJob()?.notice===discoveryNotice && activeImportJob()?.items.length?importJobReport(activeImportJob()):localizedError(discoveryNotice,language);
  const live=discoveryImporting&&activeImportJob()?jobCounts(activeImportJob()):null;
  const progress=live?panelText(`原文 ${live.downloaded}/${live.total} · MD ${live.converted}/${live.downloaded} · 分析 ${live.analyzed}/${live.converted}`,`Originals ${live.downloaded}/${live.total} · MD ${live.converted}/${live.downloaded} · Analysis ${live.analyzed}/${live.converted}`):localizedError(discoveryProgress,language);
  const resultBody = discoveryStep === 'results'
    ? `<div class="discovery-results-toolbar"><div><strong>${panelText(`检索结果（共 ${resultCount} 篇）`, `Search results (${resultCount})`)}</strong><span>${panelText(`已选 ${selectedCount} 篇，等待确认导入`, `${selectedCount} selected, ready to import`)}</span></div><label class="discovery-select-all"><input id="discovery-select-all" type="checkbox" ${resultCount && selectedCount === resultCount ? 'checked' : ''}><span>${panelText('全选本页', 'Select all')}</span></label></div>
      <div class="discovery-result-list">${discoveryResults.length ? discoveryResults.map(discoveryResultMarkup).join('') : `<p class="discovery-empty-copy">${panelText('没有找到符合当前条件的新论文。请调整左侧条件后重新检索。', 'No new matching papers. Adjust your filters and search again.')}</p>`}</div>
      <div class="discovery-results-footer"><p><span>i</span>${panelText('来源记录已核验。确认后获取全文并保存，请保持网络畅通。受限原文需手动补充。', 'Source records verified. Confirm to retrieve and save full text. Keep your network connected; restricted originals must be added manually.')}</p><div><button id="discovery-back" type="button">${panelText('返回修改条件', 'Back to filters')}</button><button id="discovery-confirm" class="discovery-confirm" type="button" ${selectedCount ? '' : 'disabled'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 15v4h14v-4"/></svg>${panelText('导入并获取可用全文', 'Import and get available full text')}</button></div></div>`
    : `<div class="discovery-results-empty"><div class="discovery-empty-orbit"><span></span><span></span><i>✦</i></div><strong>${panelText('检索结果将在这里确认', 'Review results here')}</strong><p>${panelText('填写左侧研究主题并开始检索。结果不会立即写入项目，确认选择后才会导入。', 'Describe your topic and start a search. Nothing is added until you confirm your selection.')}</p></div>`;

  discoveryWindow.innerHTML = `<header class="discovery-window-header">
      <div class="discovery-window-title"><img class="tool-window-logo" src="${BRAND_MARK}" alt=""><div><h2>${panelText('文献发现', 'Literature discovery')}</h2><p>${panelText('描述研究主题，筛选文献范围，并确认导入结果', 'Describe a topic, refine the scope, and confirm what to import')}</p></div></div>
      <div class="discovery-stepper" aria-label="${panelText('检索进度', 'Search progress')}"><span class="active"><i>1</i>${panelText('检索条件', 'Search filters')}${discoveryStep === 'results' ? '<b>✓</b>' : ''}</span><em></em><span class="${discoveryStep === 'results' ? 'active current' : ''}"><i>2</i>${panelText('结果确认', 'Confirm results')}</span></div>
      <div class="discovery-header-actions"><button id="discovery-browser-open" type="button" title="${panelText('打开浏览器','Open browser')}" aria-label="${panelText('打开浏览器','Open browser')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M7 6.5h.1M10 6.5h.1"/></svg></button><button id="discovery-search-toggle" type="button" aria-label="${panelText('文献发现','Literature discovery')}" aria-pressed="${!discoveryHistoryOpen}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 7.5v6m-3-3h6"/></svg></button><button id="discovery-history-toggle" class="${discoveryImporting?'processing':''}" type="button" aria-label="${panelText('检索与处理历史','Search and processing history')}" aria-pressed="${discoveryHistoryOpen}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6m3-4v6l4 2"/></svg></button><button id="close-literature-discovery" class="discovery-window-close" type="button" aria-label="${panelText('关闭文献发现', 'Close literature discovery')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
    </header>
${discoveryInstitutionOpen ? `<form class="discovery-institution-popover" id="discovery-institution-form"><button class="discovery-institution-dismiss" type="button" aria-label="${panelText('关闭机构入口设置', 'Close institution settings')}" data-close-institution>×</button><label for="discovery-institution-url"><strong>${panelText('出版商或机构图书馆网址', 'Publisher or institution library URL')}</strong></label><div><input id="discovery-institution-url" type="url" required placeholder="" value="${escapeHtml(discoveryInstitutionUrl)}"><button type="submit">${panelText('保存设置', 'Save settings')}</button></div></form>` : ''}
    <div class="discovery-window-body">
      <section class="discovery-conditions">
        <div class="discovery-section-heading"><h3><span>1.</span> ${panelText('检索条件', 'Search filters')}</h3><small>${discoveryStep === 'results' ? panelText('（已完成）', '(complete)') : panelText('（待填写）', '(required)')}</small></div>
        <label class="discovery-query-field"><strong>${panelText('研究主题 / 需求描述', 'Research topic / question')}</strong><textarea id="discovery-window-query" maxlength="500" placeholder="${panelText('例如：生成式 AI 如何影响大学生学习、批判性思维与学习策略？', 'Example: How does generative AI affect university learning and critical thinking?')}">${escapeHtml(discoveryQuery)}</textarea><span id="discovery-query-count">${discoveryQuery.length}/500</span></label>
        <div class="discovery-filter-row"><span class="discovery-filter-label"><i>▣</i>${panelText('年份范围', 'Years')}</span><div class="discovery-year-range"><input id="discovery-year-start" type="number" inputmode="numeric" min="1900" max="${new Date().getFullYear()}" value="${escapeHtml(discoveryFilters.yearStart)}" aria-label="${panelText('起始年份', 'Start year')}"><b>${panelText('至', 'to')}</b><input id="discovery-year-end" type="number" inputmode="numeric" min="1900" max="${new Date().getFullYear()}" value="${escapeHtml(discoveryFilters.yearEnd)}" aria-label="${panelText('结束年份', 'End year')}"></div></div>
        <div class="discovery-filter-row"><span class="discovery-filter-label"><i>◎</i>${panelText('文献语言', 'Language')}</span><div class="discovery-choices">${discoveryOption(panelText('不限', 'Any'), 'language', 'any', discoveryFilters.language)}${discoveryOption(panelText('英文', 'English'), 'language', 'en', discoveryFilters.language)}${discoveryOption(panelText('中文', 'Chinese'), 'language', 'zh', discoveryFilters.language)}</div></div>
        <div class="discovery-filter-row"><span class="discovery-filter-label"><i>□</i>${panelText('文献类型', 'Type')}</span><div class="discovery-choices">${discoveryOption(panelText('不限', 'Any'), 'articleType', 'any', discoveryFilters.articleType)}${discoveryOption(panelText('meta分析', 'Meta-analysis'), 'articleType', 'meta', discoveryFilters.articleType)}${discoveryOption(panelText('综述', 'Review'), 'articleType', 'review', discoveryFilters.articleType)}${discoveryOption(panelText('研究', 'Research'), 'articleType', 'research', discoveryFilters.articleType)}${discoveryOption(panelText('会议', 'Conference'), 'articleType', 'conference', discoveryFilters.articleType)}</div></div>
        <div class="discovery-filter-row"><span class="discovery-filter-label"><i>≋</i>${panelText('数据来源', 'Sources')}</span><div class="discovery-choices">${discoveryOption(panelText('开放获取', 'Open access'), 'source', 'open', discoveryFilters.source)}${discoveryOption(panelText('开放获取+机构登录', 'Open + institution'), 'source', 'combined', discoveryFilters.source)}${discoveryOption(panelText('机构登录', 'Institution sign-in'), 'source', 'institution', discoveryFilters.source)}</div></div>
        <div class="discovery-filter-row"><span class="discovery-filter-label"><i>↕</i>${panelText('排序方式', 'Sort')}</span><div class="discovery-choices">${discoveryOption(panelText('综合', 'Combined'), 'sort', 'combined', discoveryFilters.sort)}${discoveryOption(panelText('相关度', 'Relevance'), 'sort', 'relevance', discoveryFilters.sort)}${discoveryOption(panelText('最新', 'Newest'), 'sort', 'newest', discoveryFilters.sort)}${discoveryOption(panelText('被引量', 'Citations'), 'sort', 'cited', discoveryFilters.sort)}</div></div>
        <div class="discovery-filter-row discovery-count-row"><span class="discovery-filter-label"><i>#</i>${panelText('检索数量','Search count')}</span><div class="discovery-choices">${COUNT_OPTIONS.map(n=>discoveryOption(String(n),'resultCount',String(n),discoveryCustomCount?'custom':String(discoveryFilters.resultCount))).join('')}${discoveryOption(panelText('自定义','Custom'),'resultCount','custom',discoveryCustomCount?'custom':String(discoveryFilters.resultCount))}${discoveryCustomCount?`<input id="discovery-result-count" type="number" min="5" max="100" step="1" value="${escapeHtml(discoveryFilters.resultCount)}" aria-label="${panelText('自定义检索数量（5–100）','Custom search count (5–100)')}">`:''}</div></div>
        <aside class="discovery-strategy"><strong>✦ ${panelText('检索与导入', 'Search and import')}</strong><p>${panelText('模型生成中英文检索词组，软件检索真实来源并排序。部分原文可能受限，实际导入数量可能少于检索数量。', 'AI plans bilingual queries; LitGraph searches and ranks real sources. Access restrictions may reduce the final import count.')}</p></aside>
        ${activeImportJob()?.searchReport ? `<div class="discovery-channel-report"><strong>${panelText('已检索渠道','Searched channels')}</strong><span>${escapeHtml(activeImportJob().searchReport.sources.map(source=>source.replace('Institution browser: ',panelText('机构页面：','Institution: '))).join(panelText('、',', '))||panelText('暂无完成的渠道','No completed channels'))}</span><small>${panelText('检索词组（含原始输入）：','Queries (including original input): ')}${escapeHtml(String(activeImportJob().searchReport.queries.length))}</small>${activeImportJob().searchReport.warnings?.length?`<details><summary>${panelText('查看渠道说明','Channel details')}</summary><p>${escapeHtml(activeImportJob().searchReport.warnings.join('; '))}</p></details>`:''}${activeImportJob().searchReport.sourceReports.filter(r=>r.status==='failed').map(r=>`<small>${panelText('未完成：','Not completed: ')}${r.source==='institution'?panelText('机构登录','Institution'):panelText('开放获取','Open access')}</small>`).join('')}</div>` : ''}
        ${discoveryNotice ? `<p role="status" class="discovery-notice">${escapeHtml(activeImportJob()?.status==='ready'&&activeImportJob()?.noticeI18n?activeImportJob().noticeI18n[language]:notice)}</p>` : ''}
        ${discoveryProgress?`<p class="discovery-progress" role="status" aria-live="polite">${escapeHtml(progress)}</p>`:''}
        <button id="start-discovery" class="discovery-search-button" type="button" ${discoveryImporting ? 'disabled' : ''}>${discoverySearching ? panelText('停止检索', 'Stop search') : `✦ ${panelText('开始检索', 'Start search')}`}</button>
      </section>
      <div class="discovery-divider" role="separator" tabindex="0" aria-orientation="vertical" aria-label="${panelText('调整检索条件和结果的宽度','Resize filters and results')}" aria-valuemin="25" aria-valuemax="65" aria-valuenow="${Math.round(discoverySplit*100)}"></div>
      <section class="discovery-results"><div class="discovery-section-heading"><h3><span>2.</span> ${panelText('结果确认', 'Confirm results')}</h3><small>${discoveryStep === 'results' ? panelText('（待确认）', '(ready for review)') : panelText('（等待检索）', '(waiting)')}</small></div>${resultBody}</section>
    </div>`;

  if (discoverySearching||discoveryImporting) discoveryWindow.querySelectorAll('[data-discovery-filter], #discovery-year-start, #discovery-year-end, #discovery-window-query, #discovery-result-count, #discovery-back, #discovery-select-all, [data-discovery-result]').forEach((control) => { control.disabled = true; });
  discoveryWindow.querySelector('#discovery-browser-open').addEventListener('click',async()=>{
    if(!desktop?.institution){toast(panelText('内置浏览器需要桌面安装版。','The built-in browser requires the desktop app.'));return;}
    try{await desktop.institution('open',{blank:true,useSaved:true,projectId:currentProjectId,projectTitle:project.meta.title,language});}
    catch(error){toast(panelText('无法打开浏览器：','Could not open browser: ')+localizedError(error,language));}
  });
  discoveryWindow.querySelector('#discovery-history-toggle').addEventListener('click',()=>{discoveryHistoryOpen=!discoveryHistoryOpen;renderLiteratureDiscoveryWindow();});
  discoveryWindow.querySelector('#discovery-search-toggle').addEventListener('click',()=>{discoveryHistoryOpen=false;renderLiteratureDiscoveryWindow();});
  if(discoveryHistoryOpen){
    discoveryWindow.querySelector('.discovery-window-body').hidden=true;
    discoveryWindow.insertAdjacentHTML('beforeend',historyMarkup());
    bindHistoryActions(discoveryWindow,renderLiteratureDiscoveryWindow);
  }
  for(const [selector,top] of scrollPositions){const el=discoveryWindow.querySelector(selector);if(el)el.scrollTop=top;}
  bindDiscoveryDivider();
  discoveryWindow.querySelector('#close-literature-discovery')?.addEventListener('click', closeLiteratureDiscoveryWindow);
  const queryField = discoveryWindow.querySelector('#discovery-window-query');
  queryField?.addEventListener('input', () => {
    discoveryQuery = queryField.value;
    invalidateDiscoveryResults();
    const counter = discoveryWindow.querySelector('#discovery-query-count');
    if (counter) counter.textContent = `${discoveryQuery.length}/500`;
  });
  discoveryWindow.querySelector('#discovery-year-start')?.addEventListener('change', (event) => { discoveryFilters.yearStart = event.target.value; invalidateDiscoveryResults(); renderLiteratureDiscoveryWindow(); });
  discoveryWindow.querySelector('#discovery-year-end')?.addEventListener('change', (event) => { discoveryFilters.yearEnd = event.target.value; invalidateDiscoveryResults(); renderLiteratureDiscoveryWindow(); });
  discoveryWindow.querySelectorAll('[data-discovery-filter]').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.discoveryFilter;
    if(key==='resultCount'){discoveryCustomCount=button.dataset.discoveryValue==='custom';if(!discoveryCustomCount)discoveryFilters.resultCount=Number(button.dataset.discoveryValue);}
    else discoveryFilters[key] = button.dataset.discoveryValue;
    invalidateDiscoveryResults();
    if (key === 'source') { discoveryInstitutionOpen = false; if(usesInstitution(button.dataset.discoveryValue))void openInstitutionWindow(); }
    renderLiteratureDiscoveryWindow();
  }));
  discoveryWindow.querySelector('#discovery-result-count')?.addEventListener('input',event=>{discoveryFilters.resultCount=event.target.value;invalidateDiscoveryResults();});
  discoveryWindow.querySelector('[data-close-institution]')?.addEventListener('click', () => {
    discoveryInstitutionOpen = false;
    renderLiteratureDiscoveryWindow();
  });
  discoveryWindow.querySelector('#discovery-institution-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = discoveryWindow.querySelector('#discovery-institution-url');
    if (!input?.reportValidity()) return;
    discoveryInstitutionUrl = input.value.trim();
    localStorage.setItem('litgraph.institutionLibraryUrl', discoveryInstitutionUrl);
    discoveryInstitutionOpen = false;
    renderLiteratureDiscoveryWindow();
    toast(panelText('入口已保存，正在打开机构登录网页', 'Portal saved. Opening institution sign-in'));
    const target=pendingInstitutionNode?.projectId===currentProjectId?nodes.find(n=>n.id===pendingInstitutionNode.id):null;
    pendingInstitutionNode=null;
    await openInstitutionWindow(target,false);
  });



  discoveryWindow.querySelector('#start-discovery')?.addEventListener('click', runLiteratureDiscovery);
  discoveryWindow.querySelector('#discovery-select-all')?.addEventListener('change', (event) => {
    discoverySelected = event.target.checked ? new Set(discoveryResults.map(discoveryResultKey)) : new Set();
    renderLiteratureDiscoveryWindow();
  });
  discoveryWindow.querySelectorAll('[data-discovery-result]').forEach((input) => input.addEventListener('change', () => {
    if (input.checked) discoverySelected.add(input.dataset.discoveryResult);
    else discoverySelected.delete(input.dataset.discoveryResult);
    renderLiteratureDiscoveryWindow();
  }));
  discoveryWindow.querySelector('#discovery-back')?.addEventListener('click', () => { discoveryWindow.querySelector('#discovery-window-query')?.focus(); });
  discoveryWindow.querySelector('#discovery-confirm')?.addEventListener('click', confirmDiscoveryImport);
  if (discoveryImporting) {
    const button = discoveryWindow.querySelector('#discovery-confirm');
    if (button) { button.disabled = false; button.textContent = panelText('暂停导入', 'Pause import'); }
  } else if(activeImportJob()?.items.some(i=>i.stage!=='done')) {
    const button=discoveryWindow.querySelector('#discovery-confirm');
    if(button){button.disabled=false;button.textContent=panelText('继续导入并处理','Continue import and processing');}
  }
}

function openLiteratureDiscoveryWindow() {
  void loadDiscoveryHistory().then(()=>{
    if(!activeImportJob()){
      const recent=discoveryHistory.find(j=>j.projectId===currentProjectId);
      if(recent)showHistoricalResults(recent);
    }
    renderLiteratureDiscoveryWindow();
  });
  closeResearchWindow();
  activePanel = null;
  renderSecondaryPanel();
  if (!discoveryWindow?.isConnected) {
    discoveryWindow = document.createElement('article');
    discoveryWindow.className = 'literature-discovery-window';
    discoveryWindow.setAttribute('role', 'dialog');
    discoveryWindow.setAttribute('aria-label', panelText('文献发现', 'Literature discovery'));
    document.querySelector('#floating-window-layer').appendChild(discoveryWindow);
    discoveryWindow.disposeWindow = mountResearchWindow(discoveryWindow, floatingWindowLayer);
  }
  renderLiteratureDiscoveryWindow();
  document.querySelector('[data-panel="literature-discovery"]')?.classList.add('active');
  window.setTimeout(() => discoveryWindow?.querySelector('#discovery-window-query')?.focus(), 0);
}

function invalidateDiscoveryResults() {
  // Filter edits are drafts. The submitted search and resumable job remain intact.
}

async function runLiteratureDiscovery() {
  if (discoverySearching) {discoveryController?.abort();return;}
  if(discoveryImporting)return;
  if (!aiAvailable()) {
    discoveryNotice = panelText('请先连接模型。模型负责策略和分析，LitGraph 负责真实检索，不要求模型自带联网能力。', 'Connect a model for planning and analysis. LitGraph performs live searches; model-native browsing is not required.');
    renderLiteratureDiscoveryWindow();
    return;
  }
  discoveryQuery = discoveryWindow?.querySelector('#discovery-window-query')?.value.trim() || discoveryQuery.trim();
  if (!discoveryQuery) return toast(panelText('请先输入研究想法或问题', 'Enter a research idea or question first'));
  const from = Number(discoveryFilters.yearStart);
  const to = Number(discoveryFilters.yearEnd);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1900 || from > to || to > new Date().getFullYear()) {
    discoveryNotice = panelText('请输入有效年份，起始年份不能晚于结束年份。', 'Enter valid years with the start no later than the end.');
    renderLiteratureDiscoveryWindow();
    return;
  }
  if(usesInstitution(discoveryFilters.source)&&desktop?.institution){
    try{const saved=await desktop.institution('saved');if(saved?.saved)discoveryInstitutionUrl=saved.portalUrl||saved.url;}catch{}
  }
  if (discoveryFilters.source === 'institution' && !discoveryInstitutionUrl) {
    discoveryInstitutionOpen = true;
    renderLiteratureDiscoveryWindow();
    return;
  }
  try{discoveryCount(discoveryFilters.resultCount);}catch{discoveryNotice=panelText('检索数量请输入 5–100 的整数。','Enter a search count from 5 to 100.');renderLiteratureDiscoveryWindow();return;}
  discoveryNotice = '';
  discoveryResults = [];
  discoverySelected.clear();
  discoveryStep = 'search';
  discoverySearching = true;
  recordUse('search');
  discoveryController=new AbortController();
  const signal=discoveryController.signal;
  const job=createImportJob(currentProjectId,discoveryQuery,discoveryFilters);
  discoveryHistory.unshift(job);activeDiscoveryJobId=job.id;persistDiscoveryHistory();
  const progress=text=>{discoveryProgress=text;renderLiteratureDiscoveryWindow();};
  renderLiteratureDiscoveryWindow();
  try {
    const filters = { ...discoveryFilters };
    progress(panelText('正在生成检索策略…','Planning the search…'));
    const response=await callAI(planningMessages(discoveryQuery,filters,language),activeAIConfig(),2000,{json:true,researchMode:'quick',signal:AbortSignal.any([signal,AbortSignal.timeout(180000)])});
    const plan=normalizePlan(safeJsonFromModel(response),discoveryQuery);
    progress(panelText('正在检索学术数据源并核验筛选条件…','Searching scholarly sources and verifying filters…'));
    const retrieved=await localRequest('search',{originalQuery:discoveryQuery,queries:plan.queries,subjectTerms:plan.subjectTerms,filters,portalUrl:discoveryInstitutionUrl,projectId:currentProjectId,language,exclude:nodes.flatMap(n=>[n.openAlexId,normalizedDoi(n.doi).toLowerCase(),titleKey(n.title)].filter(Boolean))},{signal});
    job.found=retrieved.papers.length;job.searchReport={sources:retrieved.sources,sourceReports:retrieved.sourceReports||[],queryReports:retrieved.queryReports||[],queries:plan.queries,subjectTerms:plan.subjectTerms};persistDiscoveryHistory();
    // Source ranking is final. AI plans keywords once; it does not assess or
    // rewrite retrieved records. Full-paper analysis belongs to import only.
    signal.throwIfAborted();
    const results=[...retrieved.papers];
    results.splice(discoveryCount(filters.resultCount));discoveryResults=results;
    discoveryNotice=[panelText(`目标 ${filters.resultCount} 篇，实际找到 ${results.length} 篇新文献。`,`Requested ${filters.resultCount}; found ${results.length} new records.`),retrieved.incomplete?panelText('不足目标数量时不会凑数或放宽筛选。','No fabricated filler or relaxed filters.' ):'',retrieved.warnings.join('; ')].filter(Boolean).join(' ');
    job.noticeI18n={zh:`目标 ${filters.resultCount} 篇，实际找到 ${results.length} 篇新文献。${retrieved.incomplete?'仅显示已核验结果，不补足数量。':''}`,en:`Requested ${filters.resultCount}; found ${results.length} new records.${retrieved.incomplete?' Only verified results are shown; the target is not padded.':''}`};
    job.searchReport.warnings=retrieved.warnings;
    discoverySelected = new Set();
    discoveryStep = 'results';
    job.results=results;job.status='ready';job.notice=discoveryNotice;
  } catch (error) {
    discoveryNotice = signal.aborted?panelText('检索已停止，未导入任何论文。','Search stopped. No papers imported.'):panelText(`检索未完成：${localizedError(error, language)}`, `Search incomplete: ${localizedError(error, language)}`);
    job.status=signal.aborted?'paused':'error';job.error=discoveryNotice;
  } finally {
    discoverySearching = false;
    persistDiscoveryHistory();
    discoveryController=null;discoveryProgress='';
    renderLiteratureDiscoveryWindow();
  }
}

let historyWrite = Promise.resolve(), historyPending = null;
function activeImportJob() { return discoveryHistory.find(j => j.id === activeDiscoveryJobId && j.projectId === currentProjectId); }
function persistDiscoveryHistory() {
  const serialized = JSON.stringify(discoveryHistory);
  try { localStorage.setItem(HISTORY_KEY, serialized); } catch { /* Disk is the durable fallback. */ }
  // Coalesce superseded snapshots while a disk write is in flight. The latest
  // complete state remains durable without queuing dozens of stale full jobs.
  historyPending = serialized;
  historyWrite = historyWrite.catch(() => {}).then(async () => {
    if (historyPending === null) return;
    const pending = historyPending; historyPending = null;
    await localRequest('discovery-history', { jobs: JSON.parse(pending) });
  }).catch(error => {
    discoveryNotice = panelText('历史记录尚未保存到磁盘：', 'History has not been saved to disk: ') + localizedError(error, language);
  });
}
function syncPaperProgress(node, item) {
  for (const job of discoveryHistory.filter(j => j.projectId === currentProjectId)) {
    for (const other of job.items.filter(i => i.nodeId === node.id && i !== item)) {
      for (const key of ['downloaded','converted','analyzed','stage','error','rejectedRelationships','relationshipWarnings']) other[key] = item[key];
    }
    if (job.items.length && job.items.every(i => i.stage === 'done')) job.status = 'done';
  }
}
function relationshipWarningText(item) {
  const codes={unknown_peer:panelText('目标论文不在本次原文范围','Target paper outside the supplied sources'),invalid_relationship:panelText('连线字段不完整','Invalid relationship fields'),quotation_too_short:panelText('原文引句过短','Source quotation too short'),source_quote_not_found:panelText('本篇原文未匹配到引句','Quotation not found in this paper'),peer_quote_not_found:panelText('目标原文未匹配到引句','Quotation not found in the target paper'),unmapped_pdf_symbol:panelText('引句含无法识别的 PDF 符号','Quotation contains an unmapped PDF symbol')};
  const counts=new Map();
  for(const warning of item.relationshipWarnings||[]){const label=codes[warning.code]||panelText('连线未通过校验','Relationship validation failed');counts.set(label,(counts.get(label)||0)+1);}
  return panelText(`论文节点、总结和分类已保存；${item.rejectedRelationships} 条候选连线未通过校验，未加入图谱。`,`Paper node, summary and classification saved; ${item.rejectedRelationships} candidate relationships failed validation and were not added.`)+(counts.size?' '+[...counts].map(([label,count])=>`${label}: ${count}`).join('；'):'');
}
function saveImportProgress(job, node, item) {
  if (currentProjectId !== job.projectId || !nodes.some(n => n.id === node.id)) return;
  item.title=node.title;
  node.analysisStatus = item.analyzed ? 'done' : item.stage === 'analyzing' ? 'running' : 'pending';
  node.processingError = item.error || '';
  item.rejectedRelationships = node.analysisWarnings?.length || 0;
  item.relationshipWarnings = node.analysisWarnings || [];
  syncPaperProgress(node, item);
  saveCurrentProject();
  persistDiscoveryHistory();
  updateAddPapersButton();
  renderLiteratureDiscoveryWindow();
  if (selectedNode?.id === node.id) renderInspector(node);
}
async function refreshLocalMetadata(node, document, signal) {
  if(!document?.markdown)return;
  applySourceMetadata(node,extractSourceMetadata(document.markdown));
  if(!shouldRefreshLocalMetadata(node))return;
  node.doi=normalizedDoi(node.doi);
  try {
    const {metadata}=await localRequest('metadata',{doi:node.doi,title:node.title},{signal});
    if(metadata){applyScholarlyMetadata(node,metadata);node.metadataWarning='';}
    else node.metadataWarning=panelText('暂未找到精确匹配的学术记录，被引量保持未知。','No exact scholarly record found; citation count remains unknown.');
  } catch(error){signal.throwIfAborted();node.metadataWarning=localizedError(error,language);}
  node.metadataChecked=true;rebuildMetadataCitationLinks();
}
async function repairProjectSourceMetadata() {
  const projectId=currentProjectId,scope=nodes;
  let changed=0;
  for(const node of scope){
    if(currentProjectId!==projectId||nodes!==scope)return;
    if(!node.importedLocally||node.importCanvasHidden||node.sourceMetadataVersion===SOURCE_METADATA_VERSION)continue;
    try{
      const original=await getFulltext(node);
      if(currentProjectId!==projectId||nodes!==scope)return;
      if(!original?.markdown)continue;
      applySourceMetadata(node,extractSourceMetadata(original.markdown));changed++;
    }catch{/* A missing original must not block other records. */}
    if(changed&&changed%20===0){saveCurrentProject();await new Promise(resolve=>setTimeout(resolve,0));}
  }
  if(changed&&currentProjectId===projectId&&nodes===scope){saveCurrentProject();render();if(selectedNode)renderInspector(selectedNode);}
}
async function analyzeOriginal(node, signal) {
  await refreshLocalMetadata(node,await getFulltext(node),signal);
  if (!aiAvailable()) throw Object.assign(Error(panelText('原文已保存；请连接模型后继续分析。','Original saved. Connect a model to continue analysis.')),{permanent:true});
  const document = await getFulltext(node);
  if (!document?.markdown?.trim()) throw Error(panelText('尚无可分析的 MD 原文。','No Markdown original is available for analysis.'));
  const query = node.title + ' methods results findings limitations conclusion';
  const text = selectEvidence([{node,document}], query, 24000).map(e => e.text).join('\n\n');
  const peers = [];
  // Bound model context; only compare indexed originals, never infer edges from titles.
  const terms = new Set((node.title.toLowerCase().match(/[a-z]{3,}|[\u3400-\u9fff]/g) || []));
  const candidates = nodes.filter(n => n.id !== node.id && (n.fulltextKey || n.fulltextStorageKey))
    .sort((a,b) => [...terms].filter(t => b.title.toLowerCase().includes(t)).length - [...terms].filter(t => a.title.toLowerCase().includes(t)).length);
  for (const peer of candidates) {
    signal.throwIfAborted();
    const original = await getFulltext(peer);
    if (original?.markdown) peers.push({ id: peer.id, title: peer.title, text: selectEvidence([{node:peer,document:original}], query, 3200).map(e => e.text).join('\n\n') });
    if (peers.length >= 6) break;
  }
  const answerLanguage = language;
  const analysisMessages=paperAnalysisMessages(node,text,peers,project.theories,answerLanguage);
  analysisMessages[0].content+=' Also return paperCard with researchQuestion, population, methods and findings fields. Each field is {"quote":"one exact contiguous substantive passage from original_excerpts"}; use null when not explicit. Keep each quote under 900 characters. Do not translate, infer or invent missing fields. These are source-backed cards, not additional prose summaries.';
  analysisMessages[0].content+=' Also return an optional bibliography object: {"title":{"value":"original title","quote":"exact title passage"},"authors":[{"name":"paper author, not supervisor","quote":"exact byline passage"}],"year":{"value":2024,"quote":"exact publication or thesis date passage"}}. Use only supplied frontmatter, not reference entries or grants/received dates. Omit uncertain fields. Do not infer citation counts. Quotes must be literal source passages.';
  const analysisInput=JSON.parse(analysisMessages[1].content);analysisInput.frontmatter=metadataFrontmatter(document.markdown);analysisMessages[1].content=JSON.stringify(analysisInput);
  const raw = await callAI(analysisMessages, activeAIConfig(), 5000,
    {json:true,researchMode:'quick',signal:AbortSignal.any([signal,AbortSignal.timeout(180000)])});
  signal.throwIfAborted();
  const result = validatePaperAnalysis(safeJsonFromModel(raw),text,peers);
  node.researchCard=buildPaperCard(node,document,result.paperCard);
  document.paperCard=node.researchCard;
  applySourceMetadata(node,verifiedModelMetadata(result.bibliography,document.markdown));
  node.summary = result.summary.trim();
  node.summaryLanguage = answerLanguage;
  node.aiSummaryEn = answerLanguage === 'en' ? node.summary : '';
  node.aiSummaryZh = answerLanguage === 'zh' ? node.summary : '';
  node.claimLabel = typeof result.label === 'string' ? result.label.slice(0,120) : node.claimLabel;
  if (answerLanguage === 'en') node.claimLabelEn = node.claimLabel;
  node.keywords = Array.isArray(result.keywords) ? result.keywords.filter(k => typeof k === 'string').slice(0,12) : node.keywords;
  let theory = project.theories.find(t => t.id === result.theory?.id && t.id !== 'unclassified');
  if (!theory && typeof result.theory?.label === 'string' && result.theory.label.trim()) {
    theory = project.theories.find(t => t.id !== 'unclassified' && t.label === result.theory.label.trim());
    if (!theory) {
      theory = {id:'theory-'+crypto.randomUUID(),label:result.theory.label.trim().slice(0,80),labelEn:String(result.theory.labelEn||result.theory.label).slice(0,80),color:['#6984b8','#b582b8','#70a99a','#b79e69','#8d80bf'][project.theories.length%5]};
      project.theories.push(theory);
    }
  }
  if (theory) { node.primaryTheory = theory.id; enabledTheories.add(theory.id); }
  project.semanticLinks = project.semanticLinks.filter(e => !(endpointId(e.source) === node.id && e.sourceType === 'fulltext_analysis'));
  for (const edge of result.relationships) project.semanticLinks.push({
    id:'analysis-'+node.id+'-'+edge.targetId,source:node.id,target:edge.targetId,
    relation:edge.relation,strength:Math.max(1,Math.round(edge.strength*5)),rationale:edge.rationale,
    sourceQuote:edge.sourceQuote,targetQuote:edge.targetQuote,sourceType:'fulltext_analysis'
  });
  node.analysisCoverage = {source:'indexed_original_excerpts',comparedPaperIds:peers.map(p => p.id),relationshipValidation:result.relationshipValidation};
  node.analysisWarnings = result.relationshipValidation?.warnings || [];
  rebuildMetadataCitationLinks();
}
function importJobReport(job) {
  const counts=jobCounts(job),failed=job.items.filter(i=>i.stage==='error');
  return panelText(`处理结束：完整完成 ${counts.completed} 篇，失败 ${failed.length} 篇；已保存原文 ${counts.downloaded} 篇、MD ${counts.converted} 篇。失败项目保留已完成内容，可在历史详情中查看原因并重试。`,`Finished: ${counts.completed} complete, ${failed.length} failed; ${counts.downloaded} originals and ${counts.converted} Markdown files saved. Completed stages are retained; see history details for reasons and retry.`);
}
const activePaperTasks = new Map();
async function runImportJob(job, onlyNodeId = null) {
  if (discoveryImporting || discoverySearching || job.projectId !== currentProjectId) return;
  setImportCanvasVisibility(nodes,job,false);
  saveCurrentProject();
  configureSimulation(false);renderOverviewState();render();
  activeDiscoveryJobId = job.id;
  discoveryImporting = true;
  discoveryController = new AbortController();
  const jobSignal = discoveryController.signal;
  job.status = 'running';
  job.error='';job.notice='';
  recordUse('import');
  persistDiscoveryHistory();
  try {
    await processImportBatch(job.items.filter(item => !onlyNodeId || item.nodeId === onlyNodeId), async (item, stages) => {
      if (!job.items.includes(item)) return;
      jobSignal.throwIfAborted();
      if (job.projectId !== currentProjectId) throw Error('Project changed.');
      const node = nodes.find(n => n.id === item.nodeId);
      if (!node) { item.stage='error';item.error=panelText('论文节点已删除。','Paper node was deleted.');persistDiscoveryHistory();return; }
      let acquired;
      const paperController = new AbortController();
      activePaperTasks.set(node.id, paperController);
      const signal=AbortSignal.any([jobSignal,paperController.signal]);
      try { await processImportItem(item, {
        checkpoint: async () => {
          // Save each completed stage before starting another provider request.
          // Desktop storage is quota-independent; the explicit project file is
          // also usable for recovery when a browser session itself is lost.
          flushDesktopState();
          await localRequest('project',{projectId:job.projectId,project:cleanProjectForExport()});
          await historyWrite;
        },
        save: () => {
          if (['downloading','converting','analyzing'].includes(item.stage)) job.phase = item.stage;
          const count = jobCounts(job);
          discoveryProgress = panelText(`原文 ${count.downloaded}/${count.total} · MD ${count.converted}/${count.downloaded} · 分析 ${count.analyzed}/${count.converted}`,
            `Originals ${count.downloaded}/${count.total} · MD ${count.converted}/${count.downloaded} · Analysis ${count.analyzed}/${count.converted}`);
          saveImportProgress(job,node,item);
        },
        reconcile: async () => {
          const saved = await localRequest('document-state',{key:node.fulltextKey,projectId:job.projectId,nodeId:node.id},{signal});
          signal.throwIfAborted();
          if (saved) {
            node.fulltextKey=saved.key;
            if (saved.metadata) applyScholarlyMetadata(node,saved.metadata);
            if (saved.originalRelativePath) { node.originalRelativePath=saved.originalRelativePath;node.hasPdf=true; }
            node.markdownRelativePath=saved.markdownRelativePath;
            item.downloaded=Boolean(saved.originalRelativePath || saved.markdown);
            item.converted=Boolean(saved.markdown);
            if (saved.markdown) { node.fulltextStatus='indexed';node.fulltextPersistence='disk'; }
          } else {
            const cached = await getFulltext(node);
            item.downloaded=Boolean(cached?.markdown || await originalBlob(node));
            item.converted=false;
          }
          item.analyzed = item.converted && paperIsProcessed(node);
        },
        download: async () => {
          let localFile=pendingOriginalFiles.get(node.id);
          if(!localFile && node.localFileUrl?.startsWith('blob:')) {
            try {localFile=new File([await fetch(node.localFileUrl).then(r=>r.blob())],node.fileName||'original.pdf',{type:'application/pdf'});}catch{}
          }
          if(localFile){await saveOriginalFile(job.projectId,node,localFile);pendingOriginalFiles.delete(node.id);return;}
          if (!node.discoveryRecordId) throw Error(panelText('请先为这篇论文补充原文文件。','Add this paper’s original file first.'));
          // The common backend owns OA and institution routing, PDF validation,
          // persistence and cancellation. Never start a second native download
          // after a transport/storage error whose first outcome is uncertain.
          acquired=await localRequest('acquire',{recordId:node.discoveryRecordId,projectId:job.projectId,nodeId:node.id,source:job.filters?.source||'open',portalUrl:job.filters?.institutionUrl||discoveryInstitutionUrl,language},{signal});
          signal.throwIfAborted();
          item.acquisition = { status: acquired.status, source: acquired.source, elapsedMs: acquired.elapsedMs, attempts: acquired.attempts };
          applyScholarlyMetadata(node,acquired.metadata);node.fulltextKey=acquired.key;
          rebuildMetadataCitationLinks();
          if(acquired.data){node.originalRelativePath=acquired.originalRelativePath;node.hasPdf=true;node.fulltextStatus='downloaded';return;}
          node.fulltextStatus=acquired.status;
          throw Object.assign(Error(acquired.error||'No accessible original.'),{permanent:acquired.retryable===false});
        },
        convert: async () => {
          let originalDocument = await getFulltext(node);
          if (!originalDocument?.markdown) {
            const blob = acquired?.data ? new Blob([Uint8Array.from(atob(acquired.data),c=>c.charCodeAt(0))],{type:'application/pdf'}) : await originalBlob(node);
            if (!blob) throw Error(panelText('本地原文文件不可用，请补充原文。','Local original unavailable. Add the original file.'));
            const file = blob instanceof File ? blob : new File([blob],node.fileName||node.title.slice(0,100)+'.pdf',{type:'application/pdf'});
            let lastPageUpdate = 0;
            originalDocument = await extractFile(file,{signal,onProgress:(page,total) => {
              item.pages={done:page,total};
              if (Date.now()-lastPageUpdate>400 || page===total) { lastPageUpdate=Date.now();renderLiteratureDiscoveryWindow(); }
            }});
            originalDocument.originalAlreadySaved=Boolean(node.originalRelativePath);
          }
          signal.throwIfAborted();
          await saveFulltext(job.projectId,node,originalDocument);
          if (node.fulltextPersistence !== 'disk') throw Error(panelText('MD 未保存到磁盘，请检查可用空间后继续。','Markdown was not saved to disk. Check storage and continue.'));
        },
        analyze: () => analyzeOriginal(node,signal)
      },signal,{stages});
      } catch(error) { if(nodes.some(n=>n.id===node.id))throw error; }
      finally {activePaperTasks.delete(node.id);}
      if (job.projectId !== currentProjectId) return;
      configureSimulation(false);renderOverviewState();render();
    }, { signal: jobSignal, downloadConcurrency: usesInstitution(job.filters?.source) ? 1 : 2 });
    job.status=job.items.every(i=>i.stage==='done')?'done':'attention';
    job.notice=importJobReport(job);
    discoveryNotice=job.notice;
    toast(job.notice);
  } catch (error) {
    job.status=jobSignal.aborted?'paused':'attention';
    if (!jobSignal.aborted) job.error=localizedError(error,language);
  } finally {
    persistDiscoveryHistory();
    await historyWrite;
    if (job.projectId === currentProjectId) {
      if(!jobSignal.aborted) rebuildProcessedGraph();
      else configureSimulation(false);
      saveCurrentProject();
      await localRequest('project',{projectId:job.projectId,project:cleanProjectForExport()}).catch(error => {
        discoveryNotice=panelText('项目磁盘备份失败：','Project disk backup failed: ')+error.message;
      });
      renderOverviewState();render();
      if (selectedNode) renderInspector(selectedNode);
    }
    discoveryImporting=false;discoveryController=null;discoveryProgress='';
    importProgress={processing:false,done:0,total:0,ready:false};updateAddPapersButton();
    if (selectedNode) renderInspector(selectedNode);
    renderLiteratureDiscoveryWindow();
  }
}
let importPauseRequested=false;
function pauseActiveImport() {
  importPauseRequested=true;

  discoveryController?.abort();
}
async function confirmDiscoveryImport() {
  if (discoveryImporting) { pauseActiveImport();return; }
  let job=activeImportJob();
  if (job?.items.some(i=>i.stage!=='done')) return runImportJob(job);
  const chosen=discoveryResults.filter((p,i)=>discoverySelected.has(discoveryResultKey(p,i)));
  if (!chosen.length) return;
  if (!job) {
    job=createImportJob(currentProjectId,discoveryQuery,discoveryFilters,discoveryResults);
    job.status='ready';job.found=discoveryResults.length;
    discoveryHistory.unshift(job);activeDiscoveryJobId=job.id;
  }
  if(usesInstitution(job.filters.source)&&!job.filters.institutionUrl)job.filters.institutionUrl=discoveryInstitutionUrl;
  if (!project.theories.some(t=>t.id==='unclassified')) {
    project.theories.push({id:'unclassified',label:'待分类',labelEn:'Unclassified',color:'#7c6ca8'});
    enabledTheories.add('unclassified');
  }
  for (const metadata of chosen) {
    let node=nodes.find(n => metadata.recordId && n.discoveryRecordId===metadata.recordId || normalizedDoi(metadata.doi) && normalizedDoi(n.doi)===normalizedDoi(metadata.doi) || titleKey(n.title)===titleKey(metadata.title));
    if (!node) { node={...nodeFromScholarlyMetadata(metadata,nodes.length),id:'paper-'+crypto.randomUUID(),discoveryRecordId:metadata.recordId};nodes.push(node); }
    if (!job.items.some(i=>i.nodeId===node.id)) job.items.push({nodeId:node.id,title:node.title,downloaded:false,converted:false,analyzed:false,stage:'pending'});
  }
  project.nodes=nodes;project.meta.mock=false;projectIsBlank=false;
  rebuildMetadataCitationLinks();saveCurrentProject();persistDiscoveryHistory();
  // Materialize selected, verified records before the first network request.
  // A stopped simulation and the 3D graph both need an explicit refresh.
  configureSimulation();renderOverviewState();
  if(renderMode==='3d'&&view!=='table')void renderGraph3D(true);
  else render();
  await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
  await runImportJob(job);
}
async function processSinglePaper(node) {
  if (discoveryImporting || discoverySearching) return toast(panelText('请先暂停当前任务。','Pause the current task first.'));
  if(node.fileName && node.id.startsWith('local-paper-'))node.importedLocally=true;
  node.metadataChecked=false;
  let job=discoveryHistory.find(j=>j.projectId===currentProjectId && j.items.some(i=>i.nodeId===node.id));
  if (!job) {
    job=createImportJob(currentProjectId,node.title,{},[]);
    job.status='ready';job.found=1;
    job.items=[{nodeId:node.id,title:node.title,stage:'pending'}];discoveryHistory.unshift(job);
  }
  const item=job.items.find(i=>i.nodeId===node.id);
  if (item.stage==='done') { node.analysisStatus='pending';item.analyzed=false; }
  item.stage='pending';item.error='';
  await runImportJob(job,node.id);
}

async function enrichImportedNode(node, sourceText) {
  if (!aiAvailable()) return;
  try {
    const result = await callAI([
      { role: 'system', content: 'You extract academic metadata. Return only compact JSON with keys title, label, keywords (array), abstract, summary, articleType, field. Never invent numeric findings.' },
      { role: 'user', content: `File: ${node.fileName}\nContent or filename context:\n${sourceText.slice(0, 12000)}` }
    ], aiConfig, 700);
    const parsed = safeJsonFromModel(result);
    if (!parsed) return;
    node.title = parsed.title || node.title;
    node.claimLabel = parsed.label || node.claimLabel;
    node.claimLabelEn = parsed.label || node.claimLabelEn;
    node.keywords = Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8) : node.keywords;
    if (!node.abstractRetrievedAt) node.abstract = parsed.abstract || node.abstract;
    node.summary = parsed.summary || node.summary;
    node.articleType = parsed.articleType || node.articleType;
    node.field = parsed.field || node.field;
    renderOverviewState();
    render();
    toast(panelText(`AI 已整理：${node.title}`, `AI processed: ${node.title}`));
  } catch (error) {
    toast(panelText(`论文已导入，但 AI 处理失败：${error.message}`, `Paper imported, but AI processing failed: ${error.message}`));
  }
}

function acceptedPaperFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return ['pdf', 'txt', 'md', 'tex', 'csv', 'json'].includes(extension);
}

function renderStagedPaperFiles() {
  const list = document.querySelector('#paper-file-list');
  const start = document.querySelector('#start-paper-import');
  start.disabled = stagedImportFiles.length === 0;
  list.innerHTML = stagedImportFiles.length
    ? `<div class="paper-file-list-heading"><strong>${panelText(`已选择 ${stagedImportFiles.length} 个文件`, `${stagedImportFiles.length} files selected`)}</strong><button id="clear-staged-files" type="button">${panelText('清空', 'Clear')}</button></div>${stagedImportFiles.map((file, index) => `<div class="paper-file-row"><span>${escapeHtml(file.name)}</span><small>${Math.max(1, Math.round(file.size / 1024))} KB</small><button type="button" data-remove-staged-file="${index}" aria-label="${panelText('移除', 'Remove')} ${escapeHtml(file.name)}">×</button></div>`).join('')}`
    : `<p class="paper-file-empty">${panelText('尚未选择文件', 'No files selected')}</p>`;
  list.querySelector('#clear-staged-files')?.addEventListener('click', () => { stagedImportFiles = []; renderStagedPaperFiles(); });
  list.querySelectorAll('[data-remove-staged-file]').forEach((button) => button.addEventListener('click', () => {
    stagedImportFiles.splice(Number(button.dataset.removeStagedFile), 1);
    renderStagedPaperFiles();
  }));
}

function stagePaperFiles(fileList) {
  const candidates = [...fileList].filter(acceptedPaperFile);
  const known = new Set(stagedImportFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  candidates.forEach((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!known.has(key)) { stagedImportFiles.push(file); known.add(key); }
  });
  renderStagedPaperFiles();
  if (candidates.length !== fileList.length) toast(panelText('已忽略暂不支持的文件格式', 'Unsupported files were ignored'));
}

function openPaperImportDialog(files = []) {
  stagedImportFiles = [];
  paperImportHistoryOpen=false;
  document.querySelector('#paper-import-modal').hidden = false;
  renderPaperImportHistory();
  void loadDiscoveryHistory().then(renderPaperImportHistory);
  if (files.length) stagePaperFiles(files);
  else renderStagedPaperFiles();
  window.setTimeout(() => document.querySelector('#paper-dropzone').focus(), 0);
}

function updateAddPapersButton() {
  const button = document.querySelector('#add-papers-button');
  const label = button.querySelector('.add-papers-label');
  const count = button.querySelector('.add-papers-count');
  const processing=importProgress.processing||discoveryImporting;
  const job=activeImportJob(),stages=discoveryImporting&&job?.items.length?jobCounts(job):null;
  const phase=importProgress.processing?'downloading':job?.phase || 'downloading';
  const total=importProgress.processing?importProgress.total:stages?(phase==='analyzing'?stages.converted:phase==='converting'?stages.downloaded:stages.total):0;
  const done=importProgress.processing?importProgress.done:stages?(phase==='analyzing'?stages.analyzed:phase==='converting'?stages.converted:stages.downloaded):0;
  button.classList.toggle('processing', processing);
  button.classList.toggle('ready', importProgress.ready);
  button.style.setProperty('--paper-progress', `${processing&&total ? Math.round(done / total * 100) : 0}%`);
  if (processing) {
    label.textContent = phase==='analyzing'?panelText('论文分析中','Analyzing papers'):phase==='converting'?panelText('本地转换中','Converting locally'):panelText('论文导入中','Importing papers');
    count.textContent = `${done}/${total}`;
  } else if (importProgress.ready) {
    label.textContent = panelText('重新绘制画布', 'Redraw canvas');
    count.textContent = `${importProgress.total}/${importProgress.total}`;
  } else {
    label.textContent = panelText('添加论文', 'Add papers');
    count.textContent = '';
  }
  renderPaperImportHistory();
}

async function buildImportedNode(file, index) {
  const title = file.name.replace(/\.[^.]+$/, '').replaceAll('_', ' ');
  const existing=nodes.find(n=>n.fileName===file.name || titleKey(n.title)===titleKey(title));
  const node=existing || {...nodeFromScholarlyMetadata({title,authors:[],citations:null},index),id:'local-paper-'+crypto.randomUUID()};
  Object.assign(node,{fileName:file.name,importedLocally:true,metadataChecked:false,analysisStatus:'pending',processingError:''});
  pendingOriginalFiles.set(node.id,file);
  if(!existing)nodes.push(node);
  // Save every source first, even when later conversion/analysis is unavailable.
  try {await saveOriginalFile(currentProjectId,node,file);pendingOriginalFiles.delete(node.id);}
  catch(error){node.fulltextError=error.message;node.fulltextStatus='storage_failed';}
  return node;
}

async function processStagedPapers() {
  if (!stagedImportFiles.length || importProgress.processing) return;
  if(discoveryImporting || discoverySearching)return toast(panelText('请先暂停当前处理任务。','Pause the current processing task first.'));
  recordUse('import');
  const files = [...stagedImportFiles];
  importPauseRequested=false;
  closeModal('paper-import');
  if(!project.theories.some(t=>t.id==='unclassified'))project.theories.push({id:'unclassified',label:'待分类',labelEn:'Unclassified',color:'#7c6ca8'});
  enabledTheories.add('unclassified');
  const job=createImportJob(currentProjectId,panelText(`本地文件导入（${files.length} 篇）`,`Local file import (${files.length})`),{resultCount:files.length});
  job.kind='local';job.status='running';job.found=files.length;discoveryHistory.unshift(job);activeDiscoveryJobId=job.id;
  discoveryImporting=true;
  importProgress = { processing: true, done: 0, total: files.length, ready: false };
  updateAddPapersButton();
  try {
    for (const [index, file] of files.entries()) {
      const node=await buildImportedNode(file,index);
      if(!job.items.some(i=>i.nodeId===node.id))job.items.push({nodeId:node.id,title:node.title,stage:'pending',downloaded:Boolean(node.originalRelativePath||node.markdownRelativePath),converted:Boolean(node.markdownRelativePath),analyzed:false});
      project.nodes=nodes;project.meta.mock=false;projectIsBlank=false;
      importProgress.done=index+1;updateAddPapersButton();saveCurrentProject();persistDiscoveryHistory();
    }
  } finally {discoveryImporting=false;importProgress.processing=false;importProgress.ready=false;stagedImportFiles=[];updateAddPapersButton();}
  configureSimulation(false);renderOverviewState();render();
  if(importPauseRequested){job.status='paused';persistDiscoveryHistory();await historyWrite;await localRequest('project',{projectId:job.projectId,project:cleanProjectForExport()});updateAddPapersButton();renderLiteratureDiscoveryWindow();return;}
  await runImportJob(job);
}

function commitImportedPapers() {
  if (!pendingImportedNodes.length) return;
  if (!project.theories.some((theory) => theory.id === 'unclassified')) {
    project.theories.push({ id: 'unclassified', label: '待分类', labelEn: 'Unclassified', color: '#7c6ca8' });
    enabledTheories.add('unclassified');
  }
  nodes.push(...pendingImportedNodes);
  project.nodes = nodes;
  rebuildMetadataCitationLinks();
  project.meta.mock = false;
  projectIsBlank = false;
  const added = pendingImportedNodes.length;
  pendingImportedNodes = [];
  stagedImportFiles = [];
  importProgress = { processing: false, done: 0, total: 0, ready: false };
  updateAddPapersButton();
  configureSimulation(false);
  renderOverviewState();
  render();
  saveCurrentProject();
  fitView(320);
  toast(panelText(`已将 ${added} 篇论文加入画布`, `${added} papers added to the canvas`));
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  const position = pointerPosition(event);
  const node = findNode(position.x, position.y);
  if (interactionMode === 'box') {
    selectionRect = { startX: position.x, startY: position.y, endX: position.x, endY: position.y };
    pointerDown = { ...position, moved: false, node: null, selecting: true };
    selectionBox.style.left = `${position.x}px`;
    selectionBox.style.top = `${position.y}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.classList.add('show');
    return;
  }
  pointerDown = {
    ...position,
    cameraX: camera.x,
    cameraY: camera.y,
    moved: false,
    node,
    startFx: node?.fx ?? null,
    startFy: node?.fy ?? null
  };
  if (!node) {
    panning = true;
    canvas.classList.add('panning');
  }
});

canvas.addEventListener('pointermove', (event) => {
  const position = pointerPosition(event);
  if (pointerDown) {
    const moved = Math.hypot(position.x - pointerDown.x, position.y - pointerDown.y);
    if (moved > DRAG_THRESHOLD) pointerDown.moved = true;
    if (pointerDown.selecting && selectionRect) {
      selectionRect.endX = position.x;
      selectionRect.endY = position.y;
      const left = Math.min(selectionRect.startX, selectionRect.endX);
      const top = Math.min(selectionRect.startY, selectionRect.endY);
      selectionBox.style.left = `${left}px`;
      selectionBox.style.top = `${top}px`;
      selectionBox.style.width = `${Math.abs(selectionRect.endX - selectionRect.startX)}px`;
      selectionBox.style.height = `${Math.abs(selectionRect.endY - selectionRect.startY)}px`;
      return;
    }
    if (interactionMode !== 'multi' && pointerDown.node && pointerDown.moved && !draggingNode) {
      draggingNode = pointerDown.node;
      draggingNode.fx = draggingNode.x;
      draggingNode.fy = view === 'timeline' ? yearPosition(publicationValue(draggingNode)) : draggingNode.y;
      if (!graphLocked) simulation.alphaTarget(0.22).restart();
      canvas.classList.add('dragging');
    }
  }
  if (draggingNode) {
    const world = screenToWorld(position.x, position.y);
    draggingNode.fx = world.x;
    draggingNode.fy = view === 'timeline' ? yearPosition(publicationValue(draggingNode)) : world.y;
    render();
    return;
  }
  if (panning && pointerDown) {
    camera.x = pointerDown.cameraX + position.x - pointerDown.x;
    camera.y = pointerDown.cameraY + position.y - pointerDown.y;
    render();
    return;
  }
  const nextHover = findNode(position.x, position.y);
  if (nextHover !== hoveredNode) {
    hoveredNode = nextHover;
    canvas.classList.toggle('over-node', Boolean(nextHover));
    render();
  }
  showTooltip(nextHover, position);
});

canvas.addEventListener('pointerup', (event) => {
  const wasNode = pointerDown?.node ?? null;
  const wasClick = pointerDown && !pointerDown.moved;
  if (pointerDown?.selecting && selectionRect) {
    const left = Math.min(selectionRect.startX, selectionRect.endX);
    const right = Math.max(selectionRect.startX, selectionRect.endX);
    const top = Math.min(selectionRect.startY, selectionRect.endY);
    const bottom = Math.max(selectionRect.startY, selectionRect.endY);
    const boxedNodes = visibleNodes().filter((node) => {
      const x = camera.x + node.x * camera.k;
      const y = camera.y + node.y * camera.k;
      return x >= left && x <= right && y >= top && y <= bottom;
    }).map((node) => node.id);
    selectedNodes = new Set([...selectedNodes, ...boxedNodes]);
    selectionRect = null;
    selectionBox.classList.remove('show');
    pointerDown = null;
    toast(panelText(`已框选 ${selectedNodes.size} 篇论文`, `${selectedNodes.size} papers selected`));
    updateResearchEntry();
    render();
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    return;
  }
  if (draggingNode) {
    draggingNode.fx = draggingNode.x;
    draggingNode.fy = view === 'timeline' ? yearPosition(publicationValue(draggingNode)) : draggingNode.y;
    draggingNode = null;
    if (!graphLocked) simulation.alphaTarget(0);
    saveGraphState(view);
  }
  panning = false;
  pointerDown = null;
  canvas.classList.remove('dragging', 'panning');
  if (wasClick && wasNode) {
    recordUse('explore');
    if (interactionMode !== 'multi') selectedNodes.clear();
    if (interactionMode === 'multi') {
      if (selectedNodes.has(wasNode.id)) selectedNodes.delete(wasNode.id);
      else selectedNodes.add(wasNode.id);
      toast(panelText(`已选择 ${selectedNodes.size} 篇论文`, `${selectedNodes.size} papers selected`));
      updateResearchEntry();
    } else if (editMode) {
      selectedNode = wasNode;
      showNodeEditor(wasNode, pointerPosition(event));
    } else {
      wasNode.read = true;
      if (selectedNode?.id === wasNode.id && inspector.classList.contains('open')) {
        selectedNode = null;
        renderOverview();
      } else {
        selectedNode = wasNode;
        renderInspector(selectedNode);
      }
      updateResearchEntry();
    }
    render();
  }
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener('pointercancel', () => {
  if (draggingNode) {
    draggingNode.fx = pointerDown?.startFx ?? null;
    draggingNode.fy = pointerDown?.startFy ?? null;
  }
  draggingNode = null;
  panning = false;
  pointerDown = null;
  selectionRect = null;
  selectionBox.classList.remove('show');
  simulation.alphaTarget(0);
  canvas.classList.remove('dragging', 'panning');
});

canvas.addEventListener('pointerleave', () => {
  if (!draggingNode && !panning) {
    hoveredNode = null;
    canvas.classList.remove('over-node');
    tooltip.classList.remove('show');
    render();
  }
});

const held3dKeys = new Set();
let navigationFrame = 0;
let navigationTime = 0;

function canNavigate3d() {
  return renderMode === '3d' && view !== 'table' && graph3d && !graph3dHost.hidden
    && !document.activeElement?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"]')
    && !document.querySelector('.modal-backdrop:not([hidden])')
    && !floatingWindowLayer.querySelector('.summary-window:not([hidden]), .literature-discovery-window:not([hidden])');
}

function stop3dNavigation() {
  held3dKeys.clear();
  window.cancelAnimationFrame(navigationFrame);
  navigationFrame = 0;
  navigationTime = 0;
}

function step3dNavigation(time) {
  navigationFrame = 0;
  if (!held3dKeys.size || !canNavigate3d()) { stop3dNavigation(); return; }
  cancelInitial3dFit();
  const seconds = navigationTime ? (time - navigationTime) / 1000 : 1 / 60;
  navigationTime = time;
  const controls = graph3d.controls();
  const next = translateCamera(graph3d.cameraPosition(), controls.target, controls.object.up, held3dKeys, seconds);
  if (next) {
    graph3d.cameraPosition(next.position, next.target, 0);
    save3dCameraState();
    tooltip.classList.remove('show');
  }
  navigationFrame = window.requestAnimationFrame(step3dNavigation);
}

document.addEventListener('keydown', (event) => {
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) { stop3dNavigation(); return; }
  if (!navigationKeys.has(event.code) || !canNavigate3d()) return;
  event.preventDefault();
  event.stopPropagation();
  held3dKeys.add(event.code);
  if (!navigationFrame) navigationFrame = window.requestAnimationFrame(step3dNavigation);
}, true);
document.addEventListener('keyup', (event) => {
  held3dKeys.delete(event.code);
  if (!held3dKeys.size) stop3dNavigation();
});
window.addEventListener('blur', stop3dNavigation);
document.addEventListener('visibilitychange', () => { if (document.hidden) stop3dNavigation(); });
graph3dHost.addEventListener('pointerdown', () => graph3dHost.focus({ preventScroll: true }));

graph3dHost.addEventListener('pointermove', (event) => {
  const rect = graph3dHost.getBoundingClientRect();
  graph3dPointer = {
    x: (event.clientX - rect.left) * (graph3dHost.clientWidth / Math.max(1, rect.width)),
    y: (event.clientY - rect.top) * (graph3dHost.clientHeight / Math.max(1, rect.height))
  };
  if (!hoveredNode || graph3dTooltipFrame) return;
  graph3dTooltipFrame = window.requestAnimationFrame(() => {
    graph3dTooltipFrame = 0;
    showTooltip(hoveredNode, graph3dPointer, true);
  });
});

graph3dHost.addEventListener('pointerleave', () => {
  if (graph3dTooltipFrame) window.cancelAnimationFrame(graph3dTooltipFrame);
  graph3dTooltipFrame = 0;
  hoveredNode = null;
  graph3dHost.style.cursor = 'grab';
  tooltip.classList.remove('show');
  applyGraph3dFocusState();
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const position = pointerPosition(event);
  const before = screenToWorld(position.x, position.y);
  const factor = event.deltaY < 0 ? 1.13 : 0.885;
  const nextK = Math.max(view === 'timeline' ? 0.06 : 0.22, Math.min(6, camera.k * factor));
  camera.k = nextK;
  camera.x = position.x - before.x * nextK;
  camera.y = position.y - before.y * nextK;
  render();
}, { passive: false });

canvas.addEventListener('keydown', (event) => {
  const panStep = 32;
  if (event.key === '+' || event.key === '=') zoomFromCenter(1.2);
  else if (event.key === '-') zoomFromCenter(1 / 1.2);
  else if (event.key === '0') fitView(280);
  else if (event.key === 'ArrowLeft') camera.x += panStep;
  else if (event.key === 'ArrowRight') camera.x -= panStep;
  else if (event.key === 'ArrowUp') camera.y += panStep;
  else if (event.key === 'ArrowDown') camera.y -= panStep;
  else return;
  event.preventDefault();
  render();
});

function zoomFromCenter(factor) {
  if (renderMode === '3d' && graph3d) {
    const position = graph3d.cameraPosition();
    graph3d.cameraPosition({ x: position.x / factor, y: position.y / factor, z: position.z / factor }, undefined, 220);
    return;
  }
  const center = { x: width / 2, y: height / 2 };
  const before = screenToWorld(center.x, center.y);
  const nextK = Math.max(view === 'timeline' ? 0.06 : 0.22, Math.min(6, camera.k * factor));
  camera.k = nextK;
  camera.x = center.x - before.x * nextK;
  camera.y = center.y - before.y * nextK;
  render();
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
function handleWorkspaceAction(action) {
  if (action === 'reset-settings') { void resetUserSettings(); return; }
  if (action === 'clear-data') { void clearUserResearchData(); return; }
  if (action === 'data-folder') {
    const keys=nodes.map(node=>node.fulltextKey).filter(Boolean);
    void localRequest('project',{projectId:currentProjectId,project:cleanProjectForExport()}).then(()=>localRequest('data-folder',{keys})).then(result => {
      if (!result.opened) showResearchNotice(panelText('数据文件夹：', 'Data folder: ') + result.path);
    }).catch(error => toast(localizedError(error, language)));
    return;
  }
  if (action === 'import') document.querySelector('#file-input').click();
  else if (action === 'export') exportProject();
  else if (action === 'api') openModal('api');
  else if (action === 'about') openModal('about');
  else if (action === 'new') {
    createBlankProject();
  }
}

const projectSelectorButton = document.querySelector('#project-selector-button');
const projectSelectorMenu = document.querySelector('#project-selector-menu');
projectSelectorButton.addEventListener('click', () => {
  projectSelectorMenu.hidden = !projectSelectorMenu.hidden;
  projectSelectorButton.setAttribute('aria-expanded', String(!projectSelectorMenu.hidden));
});
projectSelectorMenu.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  projectSelectorMenu.hidden = true;
  projectSelectorButton.setAttribute('aria-expanded', 'false');
  if (button.dataset.projectId) {
    const entry = projectLibrary[button.dataset.projectId];
    if (!entry?.data || button.dataset.projectId === currentProjectId) return;
    saveCurrentProject();
    activateProjectData(entry.data, button.dataset.projectId);
    toast(panelText(`已切换到“${entry.title}”`, `Switched to “${entry.title}”`));
    return;
  }
  const action = button.dataset.projectAction;
  if (action === 'new') handleWorkspaceAction('new');
  if (action === 'rename') {
    const nextName = window.prompt(panelText('输入项目名称', 'Enter project name'), project.meta.title);
    if (nextName?.trim()) {
      project.meta.title = nextName.trim();
      document.querySelector('#project-selector-label').textContent = nextName.trim();
      renderOverviewState();
      saveCurrentProject();
      toast(panelText('项目已重命名', 'Project renamed'));
    }
  }
  if (action === 'delete') {
    const deletingId = currentProjectId;
    const deletingTitle = project.meta.title || panelText('当前项目', 'Current project');
    if (!window.confirm(panelText(`确定删除“${deletingTitle}”吗？此操作无法撤销。`, `Delete “${deletingTitle}”? This cannot be undone.`))) return;
    delete projectLibrary[deletingId];
    try { localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(projectLibrary)); } catch {}
    const fallback = Object.values(projectLibrary).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
    if (fallback?.data) activateProjectData(fallback.data, fallback.id);
    else createBlankProject({ savePrevious: false });
    toast(panelText(`已删除“${deletingTitle}”`, `Deleted “${deletingTitle}”`));
  }
});
document.addEventListener('pointerdown', (event) => {
  if (!projectSelectorMenu.hidden && !event.target.closest('.project-selector-wrap')) {
    projectSelectorMenu.hidden = true;
    projectSelectorButton.setAttribute('aria-expanded', 'false');
  }
});
document.querySelector('#canvas-fit-button').addEventListener('click', () => fitView(380));
document.querySelector('#zoom-in-button').addEventListener('click', () => zoomFromCenter(1.2));
document.querySelector('#zoom-out-button').addEventListener('click', () => zoomFromCenter(1 / 1.2));
document.querySelector('#lock-button').addEventListener('click', toggleGraphLock);
document.querySelector('#delete-papers-button').addEventListener('click',()=>void deletePaperNodes([...new Set([...selectedNodes,...(selectedNode?[selectedNode.id]:[])])]));
document.querySelector('#edit-mode-button').addEventListener('click', toggleEditMode);
document.querySelector('#multi-select-button').addEventListener('click', () => setInteractionMode('multi'));
document.querySelector('#box-select-button').addEventListener('click', () => setInteractionMode('box'));
document.querySelector('#fullscreen-button').addEventListener('click', () => void toggleCanvasFullscreen());
document.querySelector('#window-minimize').addEventListener('click', (event) => {
  if (desktop) return void desktop.control('minimize');
  const shell = document.querySelector('.app-shell');
  const minimized = shell.classList.toggle('preview-minimized');
  event.currentTarget.setAttribute('aria-pressed', String(minimized));
  event.currentTarget.setAttribute('aria-label', panelText(minimized ? '恢复窗口' : '最小化窗口', minimized ? 'Restore window' : 'Minimize window'));
});
let desktopWindowState = { maximized: false, fullscreen: false };
function updateWindowControl() {
  const expanded = desktop ? desktopWindowState.maximized || desktopWindowState.fullscreen : Boolean(document.fullscreenElement);
  const button = document.querySelector('#window-maximize');
  button.innerHTML = `<svg viewBox="0 0 12 12" aria-hidden="true">${expanded ? '<path d="M4.5 3V1.5h6v6H9"/><rect x="1.5" y="4.5" width="6" height="6"/>' : '<rect x="2.5" y="2.5" width="7" height="7"/>'}</svg>`;
  const label = expanded ? panelText('还原窗口', 'Restore window') : panelText('最大化窗口', 'Maximize window');
  button.setAttribute('aria-label', label);
  button.title = label;
  button.setAttribute('aria-pressed', String(expanded));
}
desktop?.onWindowState?.(state => { desktopWindowState = state; updateWindowControl(); });
desktop?.windowState?.().then(state => { desktopWindowState = state; updateWindowControl(); }).catch(() => {});
document.addEventListener('fullscreenchange', updateWindowControl);
document.querySelector('#window-maximize').addEventListener('click', async () => {
  if (desktop) return void desktop.control('maximize');
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  else await document.documentElement.requestFullscreen?.().catch(() => {});
  updateWindowControl();
});
document.querySelector('#window-close').addEventListener('click', () => desktop ? void desktop.control('close') : toast(panelText('当前为网页预览；桌面版本将在此处关闭窗口', 'This is the web preview; the desktop build will close here')));
document.querySelector('#research-desk-entry').addEventListener('click', () => {
  if (deepReadWindow?.isConnected) closeResearchWindow();
  else openDeepReadWindow(selectedNodes.size ? null : selectedNode);
});
document.querySelector('#theme-button').addEventListener('click', () => applyTheme(theme === 'light' ? 'dark' : 'light'));
document.querySelector('#language-button').addEventListener('click', () => { language = language === 'zh' ? 'en' : 'zh'; applyLanguage(); });
document.querySelector('#display-toggle').addEventListener('click', (event) => {
  const toggle = event.currentTarget;
  const submenu = document.querySelector('#display-submenu');
  const expanded = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(expanded));
  submenu.setAttribute('aria-hidden', String(!expanded));
  submenu.toggleAttribute('inert', !expanded);
  submenu.classList.toggle('expanded', expanded);
});
document.querySelectorAll('[data-panel]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.panel === 'literature-discovery') {
    if (discoveryWindow?.isConnected) closeLiteratureDiscoveryWindow();
    else openLiteratureDiscoveryWindow();
    return;
  }
  activePanel = activePanel === button.dataset.panel ? null : button.dataset.panel;
  renderSecondaryPanel();
}));
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && fullscreenCanvas) {
    fullscreenCanvas = false;
    document.querySelector('.app-shell').classList.remove('canvas-only');
    updateModeButtons();
    window.setTimeout(resizeCanvas, 50);
  }
});

document.querySelector('#save-node-label').addEventListener('click', () => {
  const value = document.querySelector('#node-label-input').value.trim();
  if (!editingNode || !value) return;
  editingNode.claimLabel = value;
  if (editingNode.language === 'en') editingNode.claimLabelEn = value;
  nodeEditPopover.hidden = true;
  toast(panelText('修改已保存', 'Changes saved'));
  render();
});
document.querySelector('#node-label-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') document.querySelector('#save-node-label').click();
  if (event.key === 'Escape') nodeEditPopover.hidden = true;
});

document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('pointerdown', (event) => {
  if (event.target === backdrop) closeModal(backdrop.id.replace('-modal', ''));
}));
document.querySelector('#api-model').addEventListener('change', (event) => {
  document.querySelector('#api-vision').checked = false;
  document.querySelector('#custom-model').hidden = event.target.value !== 'custom';
  const catalog = MODEL_CATALOG[event.target.value];
  if (catalog) document.querySelector('#api-endpoint').value = catalog.endpoint;
  if (event.target.value === 'custom') document.querySelector('#custom-model').focus();
});
document.querySelector('#toggle-api-key').addEventListener('click', (event) => {
  const input = document.querySelector('#api-key');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  event.currentTarget.textContent = panelText(showing ? '显示' : '隐藏', showing ? 'Show' : 'Hide');
  event.currentTarget.setAttribute('aria-label', panelText(showing ? '显示 API Key' : '隐藏 API Key', showing ? 'Show API key' : 'Hide API key'));
  event.currentTarget.setAttribute('aria-pressed', String(!showing));
  input.focus();
});
let changingSettings = false;
function settingsHaveActiveWork() {
  return changingSettings || discoverySearching || discoveryImporting || receivingInstitution || importProgress.processing || researchAttachmentLoads.size || activePaperTasks.size || [...researchRequests.values()].some(run=>run.status==='pending') || document.querySelector('#test-api-button').disabled;
}
async function resetUserSettings() {
  if(settingsHaveActiveWork())return toast(panelText('请先暂停或等待当前任务完成，再还原设置。','Pause or finish active tasks before resetting settings.'));
  const confirmed=await new Promise(resolve=>{
    const overlay=document.createElement('div');overlay.className='modal-backdrop delete-confirm-backdrop';
    const previous=document.activeElement;
    overlay.innerHTML=`<section class="settings-dialog delete-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-settings-title"><h2 id="reset-settings-title">${panelText('还原所有设置？','Reset all settings?')}</h2><p>${panelText('清除 API 地址、密钥和模型配置，解除外部 Agent 配对，清除机构登录状态及入口网址，并还原语言、显示和界面偏好。','Remove API settings and key, disconnect external agent pairing, clear institution sign-in and portal URL, and restore language, display and interface preferences.')}</p><p>${panelText('保留全部项目、PDF、MD、分析、向量、节点图 JSON、对话及导入历史。不会删除研究数据。','All projects, PDFs, Markdown, analyses, vectors, graph JSON, conversations and import history are retained. No research data is deleted.')}</p><footer><button type="button" data-reset-cancel>${panelText('取消','Cancel')}</button><button type="button" data-reset-confirm>${panelText('确认还原','Confirm reset')}</button></footer></section>`;
    const finish=value=>{overlay.remove();previous?.isConnected&&previous.focus();resolve(value);};
    overlay.querySelector('[data-reset-cancel]').onclick=()=>finish(false);
    overlay.querySelector('[data-reset-confirm]').onclick=()=>finish(true);
    overlay.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false);}if(event.key==='Tab'){event.preventDefault();const buttons=[...overlay.querySelectorAll('button')];buttons[(buttons.indexOf(document.activeElement)+1)%2].focus();}};
    document.body.append(overlay);overlay.querySelector('[data-reset-cancel]').focus();
  });
  if(!confirmed)return;
  if(settingsHaveActiveWork())return toast(panelText('有任务正在处理，请稍后再还原设置。','A task is active. Reset settings after it finishes.'));
  changingSettings=true;
  const blocker=document.createElement('div');blocker.className='modal-backdrop delete-confirm-backdrop';blocker.setAttribute('role','status');blocker.textContent=panelText('正在还原设置…','Resetting settings…');document.body.append(blocker);
  try {
    saveCurrentProject();await historyWrite;
    await localRequest('disconnect',{});
    const snapshot=workspaceSnapshot();
    if(desktop)await desktop.resetSettings(snapshot);
    for(const key of preferenceKeys)localStorage.removeItem(key);
    aiConfig=null;
    flushDesktopState();
    location.reload();
  }catch(error){blocker.remove();changingSettings=false;toast(localizedError(error,language));}
}
async function clearUserResearchData(){
 if(!desktop)return toast(panelText('请在桌面安装版中清除数据。','Clear data in the desktop app.'));
 if(settingsHaveActiveWork())return toast(panelText('请先暂停导入、分析和问答，再清除数据。','Pause imports, analyses and answers before clearing data.'));
 changingSettings=true;
 try{await historyWrite;const result=await desktop.clearData(workspaceSnapshot());if(result.cleared)location.reload();}
 catch(error){toast(localizedError(error,language));}finally{changingSettings=false;}
}

document.querySelector('#delete-api-config').addEventListener('click',async()=>{
  if(settingsHaveActiveWork())return toast(panelText('请先暂停或等待当前任务完成，再删除配置。','Pause or finish active tasks before deleting the configuration.'));
  changingSettings=true;
  try {
    if(desktop)await desktop.deleteConfig();
    localStorage.removeItem('litgraph.aiConfig');aiConfig=null;
    openModal('api');updateModelBadge();
    toast(panelText('API 配置已删除，研究数据已保留。','API configuration deleted. Research data is retained.'));
  }catch(error){toast(localizedError(error,language));}finally{changingSettings=false;}
});
document.querySelector('#api-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if(changingSettings || document.querySelector('#test-api-button').disabled)return;
  const errorHost = document.querySelector('#api-error');
  const submit = document.querySelector('#test-api-button');
  const modelChoice = document.querySelector('#api-model').value;
  const selectedModel = modelChoice === 'custom' ? document.querySelector('#custom-model').value.trim() : modelChoice;
  const catalog = MODEL_CATALOG[selectedModel];
  const candidate = {
    endpoint: document.querySelector('#api-endpoint').value.trim(),
    apiKey: document.querySelector('#api-key').value.trim(),
    model: selectedModel,
    provider: catalog?.provider || 'custom',
    protocol: catalog?.protocol || 'openai-chat',
    vision: document.querySelector('#api-vision').checked,
    verified: false
  };
  if (!candidate.endpoint || !candidate.apiKey || !candidate.model) {
    errorHost.textContent = panelText('接入失败，请完整填写 API 地址、Key 和模型。', 'Connection failed. Complete the API URL, key, and model.');
    errorHost.hidden = false;
    errorHost.focus();
    return;
  }
  errorHost.hidden = true;
  submit.disabled = true;
  submit.textContent = panelText('正在测试…', 'Testing…');
  try {
    await callAI([{ role: 'user', content: 'Reply with exactly: LitGraph API OK' }], candidate, /reasoner/i.test(candidate.model) ? 4096 : 64, { connectionTest: true });
    candidate.verified = true;
    if (externalState().connected) { await localRequest('disconnect', {}); await refreshExternal(); }
    if (desktop) await desktop.saveConfig(candidate);
    else localStorage.setItem('litgraph.aiConfig', JSON.stringify(candidate));
    aiConfig = candidate;
    updateModelBadge();
    closeModal('api');
    toast(panelText('修改已保存', 'Changes saved'));
  } catch (error) {
    errorHost.textContent = panelText(`接入失败，请检查。${localizedError(error, language)}`, `Connection failed. Check the settings. ${localizedError(error, language)}`);
    errorHost.hidden = false;
    errorHost.focus();
  } finally {
    submit.disabled = false;
    submit.textContent = panelText('测试并保存', 'Test & save');
  }
});

document.querySelector('#copy-agent-instructions').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    if (externalState().managed && externalState().configured) throw Error(panelText('请先断开按需调用，再启用手动 MCP 接入。', 'Disconnect on-demand execution before enabling manual MCP.'));
    const instructions = await externalInstructions(agentPageContext(), language);
    await copyTextToClipboard(instructions, language);
    updateModelBadge();
    toast(panelText('接入说明已复制。请发给外部 Agent，保持此页面打开。', 'Instructions copied. Send them to your external agent and keep this page open.'));
  } catch (error) { showResearchNotice(panelText(`无法复制接入说明：${error.message}`, `Cannot copy connection instructions: ${error.message}`)); }
  finally { button.disabled = false; }
});
for (const [id, action] of [['connect-agent-runtime', 'connect'], ['choose-agent-runtime', 'choose']]) {
  document.querySelector(`#${id}`).addEventListener('click', async () => {
    const errorHost = document.querySelector('#agent-error');
    if (!desktop?.agentRuntime) { errorHost.textContent = panelText('按需调用需要使用 LitGraph 桌面版。', 'On-demand execution requires the LitGraph desktop app.'); errorHost.hidden = false; return; }
    if (settingsHaveActiveWork()) return toast(panelText('请先完成或暂停当前 AI 任务。', 'Finish or pause current AI tasks first.'));
    const controls = ['#connect-agent-runtime', '#choose-agent-runtime', '#agent-runtime-provider', '#test-api-button', '#disconnect-agent', '#copy-agent-instructions'].map(selector => document.querySelector(selector));
    controls.forEach(control => control.disabled = true);
    errorHost.hidden = true;
    const connect = document.querySelector('#connect-agent-runtime');
    connect.textContent = panelText('验证中…', 'Verifying…');
    try {
      const result = await desktop.agentRuntime(action, { provider: document.querySelector('#agent-runtime-provider').value });
      if (result) { await refreshExternal(); updateModelBadge(); }
    } catch (error) {
      errorHost.textContent = panelText(`未能接入：${localizedError(error, language)}`, `Connection failed: ${localizedError(error, language)}`);
      errorHost.hidden = false;
    } finally {
      controls.forEach(control => control.disabled = false);
      connect.textContent = panelText('测试并保存', 'Test & save');
    }
  });
}
document.querySelector('#disconnect-agent').addEventListener('click', async () => {
  try { await localRequest('disconnect', {}); await refreshExternal(); updateModelBadge(); }
  catch (error) { toast(localizedError(error, language)); }
});
// Status is based on authenticated activity, never on copying the instructions.
async function pollExternalAgent() {
  await refreshExternal(); updateModelBadge();
  if (externalState().connected) await localRequest('context', agentPageContext()).catch(() => {});
}
setInterval(() => { void pollExternalAgent(); }, 3000);
void pollExternalAgent();

document.querySelector('#choose-documents-button').addEventListener('click', () => openPaperImportDialog());
document.querySelector('#empty-model-access').addEventListener('click', () => openModal('api'));
document.querySelector('#empty-sample-project').addEventListener('click', () => {
  recordUse('sample');
  saveCurrentProject();
  activateProjectData(createSampleProject(), SAMPLE_PROJECT_ID);
  toast(panelText('已载入样例数据', 'Sample data loaded'));
});
document.querySelector('#empty-literature-discovery').addEventListener('click', () => {
  openLiteratureDiscoveryWindow();
});
document.querySelector('#add-papers-button').addEventListener('click', () => {
  if (importProgress.ready) commitImportedPapers();
  else openPaperImportDialog();
});
document.querySelector('#paper-import-history-toggle').addEventListener('click',()=>{paperImportHistoryOpen=!paperImportHistoryOpen;renderPaperImportHistory();});
document.querySelector('#paper-file-picker').addEventListener('click', (event) => {
  event.stopPropagation();
  document.querySelector('#document-input').click();
});
document.querySelector('#paper-dropzone').addEventListener('click', (event) => {
  if (!event.target.closest('button')) document.querySelector('#document-input').click();
});
document.querySelector('#paper-dropzone').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.querySelector('#document-input').click(); }
});
document.querySelector('#paper-dropzone').addEventListener('dragover', (event) => { event.preventDefault(); event.currentTarget.classList.add('dragging'); });
document.querySelector('#paper-dropzone').addEventListener('dragleave', (event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.classList.remove('dragging'); });
document.querySelector('#paper-dropzone').addEventListener('drop', (event) => {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('dragging');
  stagePaperFiles(event.dataTransfer.files);
});
document.querySelector('#start-paper-import').addEventListener('click', () => void processStagedPapers());
document.querySelector('#document-input').addEventListener('change', (event) => {
  stagePaperFiles(event.target.files);
  event.target.value = '';
});
workspace.addEventListener('dragenter', (event) => { if (![...event.dataTransfer.types].includes('Files')) return; event.preventDefault(); dropOverlay.classList.add('show'); });
workspace.addEventListener('dragover', (event) => { if (![...event.dataTransfer.types].includes('Files')) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
workspace.addEventListener('dragleave', (event) => { if (!workspace.contains(event.relatedTarget)) dropOverlay.classList.remove('show'); });
workspace.addEventListener('drop', (event) => {
  if (![...event.dataTransfer.types].includes('Files')) return;
  event.preventDefault();
  dropOverlay.classList.remove('show');
  openPaperImportDialog(event.dataTransfer.files);
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  document.querySelectorAll('.modal-backdrop:not([hidden])').forEach((modal) => closeModal(modal.id.replace('-modal', '')));
  nodeEditPopover.hidden = true;
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') search();
  if (event.key === 'Escape') {
    searchInput.value = '';
    searchNodes.clear();
    selectedNodes.clear();
    render();
  }
});

document.querySelector('#file-input').addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) void importProject(file);
  event.target.value = '';
});

const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(workspace);
let canvasResizeFrame = 0;
const scheduleCanvasPixelResize = () => {
  window.cancelAnimationFrame(canvasResizeFrame);
  canvasResizeFrame = window.requestAnimationFrame(resizeCanvas);
};
window.addEventListener('resize', scheduleCanvasPixelResize, { passive: true });
window.visualViewport?.addEventListener('resize', scheduleCanvasPixelResize, { passive: true });
function watchDisplayPixelRatio() {
  const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  query.addEventListener('change', () => {
    scheduleCanvasPixelResize();
    watchDisplayPixelRatio();
  }, { once: true });
}
watchDisplayPixelRatio();

nodes = project.nodes.map((node) => ({ read: false, viewPositions: {}, ...node, secondaryTheories: [...node.secondaryTheories], authors: [...node.authors] }));
enabledTheories = new Set(project.theories.map((theory) => theory.id));
updateSidebarAvailability();
applyPanelWidths();
bindSidebarResizer();
initializePositions();
renderOverview();
renderOverviewState();
resizeCanvas();
configureSimulation();
applyLanguage();
applyTheme('light', false);
updateModelBadge();
updateModeButtons();
saveCurrentProject();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveCurrentProject(); });
void repairProjectSourceMetadata();
window.addEventListener('beforeunload', saveCurrentProject);
if(desktop?.institution){
  desktop.onInstitutionDownload?.(()=>void receiveInstitutionDownloads());
  setInterval(()=>void receiveInstitutionDownloads(),2500);

  window.addEventListener('focus',()=>void receiveInstitutionDownloads());
}
window.setTimeout(() => {
  if (view === 'semantic' && renderMode === '2d' && layoutBasis === 'argument') fitView(380);
}, 700);
