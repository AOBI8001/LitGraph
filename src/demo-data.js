export const THEORIES = [
  { id: 'cognitive-offloading', label: '认知卸载', labelEn: 'Cognitive offloading', color: '#256aa3' },
  { id: 'self-regulated-learning', label: '自我调节学习', labelEn: 'Self-regulated learning', color: '#7952a5' },
  { id: 'cognitive-load', label: '认知负荷', labelEn: 'Cognitive load', color: '#d76a16' },
  { id: 'constructivism', label: '建构主义', labelEn: 'Constructivism', color: '#258c42' },
  { id: 'metacognition', label: '元认知', labelEn: 'Metacognition', color: '#c82f3a' },
  { id: 'distributed-cognition', label: '分布式认知', labelEn: 'Distributed cognition', color: '#a1a10b' },
  { id: 'technology-acceptance', label: '技术接受', labelEn: 'Technology acceptance', color: '#82472f' },
  { id: 'critical-pedagogy', label: '批判教育学', labelEn: 'Critical pedagogy', color: '#d45f9e' }
];

export const RELATION_COLORS = {
  support: '#159a55',
  oppose: '#e23843',
  related: '#7f8995'
};

const SUBJECTS = [
  '生成式 AI 与批判性思维', 'AI 辅助写作与推理质量', '大语言模型与认知卸载',
  'AI 反馈素养', '学生对生成内容的核查行为', '人机协同学习策略',
  '生成式 AI 与长期知识迁移', 'AI 使用中的认知努力', '提示设计与反思性学习',
  '高校生成式 AI 素养', '自动化反馈与自主学习', 'AI 依赖和学习表现'
];

const ENGLISH_KEYWORDS = [
  'critical thinking · verification', 'AI-assisted writing · reasoning', 'cognitive offloading · LLMs',
  'AI feedback literacy', 'source checking · trust', 'human–AI learning',
  'knowledge transfer · retention', 'cognitive effort · automation', 'prompting · reflection',
  'generative AI literacy', 'automated feedback · autonomy', 'AI dependence · performance'
];

const CITATION_LEVELS = [0, 3, 8, 16, 34, 68, 125, 260, 540, 980, 1850, 4200];

const METHODS = [
  'a multi-university field study', 'a controlled classroom experiment',
  'a longitudinal student survey', 'a mixed-methods course study',
  'a think-aloud comparison', 'a systematic evidence review'
];

const AUTHORS = [
  'Avery Chen', 'Maya Patel', 'Noah Williams', 'Sofia García', 'Lena Hoffmann',
  'Min Zhang', 'Isla Campbell', 'Ethan Walker', 'Hana Kim', 'Owen Stewart'
];

const JOURNALS = [
  'Computers & Education', 'Learning and Instruction', 'Educational Psychology Review',
  'British Journal of Educational Technology', 'Internet and Higher Education', '教育研究'
];

const ARTICLE_TYPES = ['Research article', 'Review article', 'Case study'];
const FIELDS = ['Educational technology', 'Learning sciences', 'Cognitive psychology', 'Higher education'];

function rng(seed = 20260826) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function sample(random, values) {
  return values[Math.floor(random() * values.length)];
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function createDemoProject() {
  const random = rng();
  const nodes = [];

  THEORIES.forEach((theory, theoryIndex) => {
    for (let index = 0; index < 12; index += 1) {
      const subject = SUBJECTS[(theoryIndex * 3 + index) % SUBJECTS.length];
      const method = METHODS[(index + theoryIndex) % METHODS.length];
      const year = 2017 + ((index * 2 + theoryIndex) % 10);
      const month = 1 + ((index * 3 + theoryIndex * 2) % 12);
      const citations = Math.max(0, Math.round(CITATION_LEVELS[(index + theoryIndex * 3) % CITATION_LEVELS.length] * (0.88 + random() * 0.24)));
      const english = index % 4 !== 0;
      const secondaryTheories = [];
      if (random() < 0.42) secondaryTheories.push(THEORIES[(theoryIndex + 1 + Math.floor(random() * 3)) % THEORIES.length].id);
      if (random() < 0.12) secondaryTheories.push(THEORIES[(theoryIndex + 4) % THEORIES.length].id);
      const sequence = String(nodes.length + 1).padStart(3, '0');

      nodes.push({
        id: `mock-paper-${sequence}`,
        title: english
          ? `Mock study ${sequence}: ${subject}, ${method}`
          : `Mock 研究 ${sequence}：${subject}的${['实验研究', '纵向分析', '混合方法研究'][index % 3]}`,
        authors: [sample(random, AUTHORS), sample(random, AUTHORS)].filter((name, i, all) => all.indexOf(name) === i),
        year,
        month,
        language: english ? 'en' : 'zh',
        primaryTheory: theory.id,
        secondaryTheories,
        citations,
        impact: 0,
        theoryStrength: 0.42 + random() * 0.58,
        claimLabel: subject,
        claimLabelEn: ENGLISH_KEYWORDS[(theoryIndex * 3 + index) % ENGLISH_KEYWORDS.length],
        keywords: ENGLISH_KEYWORDS[(theoryIndex * 3 + index) % ENGLISH_KEYWORDS.length].split(' · '),
        journal: JOURNALS[(index + theoryIndex) % JOURNALS.length],
        field: FIELDS[(index * 2 + theoryIndex) % FIELDS.length],
        articleType: ARTICLE_TYPES[(index + theoryIndex) % ARTICLE_TYPES.length],
        hasPdf: random() > 0.19,
        doi: `10.0000/litgraph.mock.${sequence}`,
        url: `https://doi.org/10.0000/litgraph.mock.${sequence}`,
        pdfUrl: `https://example.org/mock-papers/${sequence}.pdf`,
        abstract: english
          ? `This mock abstract examines ${subject.toLowerCase()} through ${method}. It is included only to demonstrate metadata, local full-text status, and paper-level retrieval interactions.`
          : `本 Mock 摘要通过${method}考察${subject}，仅用于演示元数据、全文状态和单篇论文问答交互。`,
        summary: `Mock 结论：该研究从“${theory.label}”视角考察${subject}。结果用于演示图谱聚类、证据状态与关系交互，不能作为真实学术引用。`,
        detailedResults: {
          question: `生成式 AI 如何通过${theory.label}机制影响${subject}？`,
          method: `${method}，纳入 ${120 + ((index * 37 + theoryIndex * 19) % 780)} 名参与者。`,
          conclusion: `核查行为与反思提示能够调节 AI 使用和学习结果之间的关系。`,
          metrics: [
            `主要效应 β=${(0.18 + random() * 0.42).toFixed(2)}`,
            `组间差异 d=${(0.22 + random() * 0.76).toFixed(2)}`,
            `模型解释率 R²=${(0.16 + random() * 0.38).toFixed(2)}`
          ]
        },
        evidence: `Mock evidence excerpt ${sequence}: Students' outcomes varied with the way generated answers were checked and incorporated into the learning task.`,
        isMock: true
      });
    }
  });

  const citationOrder = [...nodes].sort((a, b) => b.citations - a.citations);
  citationOrder.forEach((node, index) => {
    node.impact = 1 - index / Math.max(1, citationOrder.length - 1);
  });

  const semanticLinks = [];
  const usedSemantic = new Set();
  const addSemantic = (source, target, type, strength) => {
    const key = pairKey(source, target);
    if (source === target || usedSemantic.has(key)) return;
    usedSemantic.add(key);
    semanticLinks.push({
      id: `semantic-${semanticLinks.length + 1}`,
      source,
      target,
      relation: type,
      strength,
      rationale: type === 'support'
        ? 'Mock：两篇论文对核心机制给出方向一致的结论。'
        : type === 'oppose'
          ? 'Mock：两篇论文对学习收益或认知代价给出相反判断。'
          : 'Mock：研究问题或方法高度相关，但不构成直接支持或反对。'
    });
  };

  THEORIES.forEach((_theory, theoryIndex) => {
    const group = nodes.slice(theoryIndex * 12, theoryIndex * 12 + 12);
    group.forEach((node, index) => {
      const next = group[(index + 1) % group.length];
      const second = group[(index + 3 + (index % 2)) % group.length];
      addSemantic(node.id, next.id, random() < 0.72 ? 'support' : 'related', 3 + Math.floor(random() * 3));
      addSemantic(node.id, second.id, random() < 0.12 ? 'oppose' : 'related', 2 + Math.floor(random() * 3));
    });
  });

  for (let index = 0; index < THEORIES.length; index += 1) {
    const groupA = nodes.slice(index * 12, index * 12 + 12);
    const groupB = nodes.slice(((index + 1) % THEORIES.length) * 12, ((index + 1) % THEORIES.length) * 12 + 12);
    for (let bridge = 0; bridge < 3; bridge += 1) {
      const typeRoll = random();
      addSemantic(
        sample(random, groupA).id,
        sample(random, groupB).id,
        typeRoll < 0.36 ? 'support' : typeRoll < 0.7 ? 'oppose' : 'related',
        3 + Math.floor(random() * 3)
      );
    }
  }

  const citationLinks = [];
  const usedCitations = new Set();
  nodes.forEach((node) => {
    const older = nodes.filter((candidate) => candidate.year < node.year);
    const count = Math.min(older.length, 2 + Math.floor(random() * 3));
    for (let index = 0; index < count; index += 1) {
      const sameTheory = older.filter((candidate) => candidate.primaryTheory === node.primaryTheory);
      const pool = sameTheory.length && random() < 0.7 ? sameTheory : older;
      const target = sample(random, pool);
      const key = `${node.id}|${target.id}`;
      if (usedCitations.has(key)) continue;
      usedCitations.add(key);
      citationLinks.push({ id: `citation-${citationLinks.length + 1}`, source: node.id, target: target.id });
    }
  });

  return {
    meta: {
      schemaVersion: '0.1',
      title: '生成式 AI 如何影响大学生学习与批判性思维？',
      mock: true
    },
    theories: THEORIES.map((theory) => ({ ...theory })),
    nodes,
    semanticLinks,
    citationLinks
  };
}
