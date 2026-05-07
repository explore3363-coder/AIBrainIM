import type {
  Agent, Task, BrainStore, CommandTrace,
  AIFeedItem, ConfirmationItem, ProfileStats,
} from '../types';

// ─── Design Tokens ────────────────────────────────────────────────────────────
export const C = {
  bgRoot:        '#050d1a',
  bgCard:        'rgba(13,22,40,0.72)',
  bgGlass:       'rgba(20,35,60,0.55)',
  bgElevated:    '#0c1830',
  borderSubtle:  'rgba(56,100,200,0.18)',
  borderActive:  'rgba(56,189,248,0.55)',
  primary:       '#38bdf8',
  primaryDark:   '#0284c7',
  primaryGlow:   'rgba(56,189,248,0.28)',
  accent:        '#22d3ee',
  accentGlow:    'rgba(34,211,238,0.25)',
  textTitle:     '#f1f5f9',
  textBody:      '#cbd5e1',
  textMuted:     '#64748b',
  textDim:       '#334155',
  online:        '#22d3ee',
  working:       '#38bdf8',
  idle:          '#94a3b8',
  watching:      '#818cf8',
  stateRunning:  '#1d4ed8',
  stateTodo:     '#1e293b',
  stateDone:     '#065f46',
  stateBlocked:  '#881337',
  tabBg:         'rgba(5,13,26,0.92)',
  tabActive:     '#38bdf8',
  tabInactive:   '#64748b',
  highUrgency:   '#f87171',
  normalUrgency: '#fbbf24',
  lowUrgency:    '#34d399',
} as const;

// ─── Mock Agents ──────────────────────────────────────────────────────────────
export const agentsMock: Agent[] = [
  {id:'zhuli',  name:'助理',    role:'AI 总指挥',         status:'online',  accent:C.accent,    focus:'接收指令、拆任务、调度、总结',         current:'汇总移动端 P0 体验需求'},
  {id:'renzhi', name:'认知中枢', role:'后台认知层',         status:'watching',accent:'#a78bfa',  focus:'长上下文、冲突消歧、夜训门控',         current:'维护深层判断框架'},
  {id:'xunlong',name:'寻龙',    role:'矿业研究员',         status:'idle',    accent:'#fbbf24',  focus:'钨价、政策、全球矿业信源',             current:'等待矿业研究调度'},
  {id:'wuyin',  name:'无垠',    role:'矿山项目工程',        status:'working', accent:'#34d399',  focus:'智慧矿山与三维数字孪生',              current:'聚源三维项目链路维护'},
  {id:'tansuo', name:'探索',    role:'采选矿专家',          status:'online',  accent:'#fb7185',  focus:'XRT、磨浮、回收率、药剂',              current:'采选矿判断待命'},
  {id:'zhilian',name:'智联',    role:'知识库管理员',         status:'online',  accent:C.primary,  focus:'归档、记忆、NAS、资料治理',           current:'知识库与记忆库状态巡检'},
  {id:'heijin', name:'黑金',    role:'AI 项目工程师',        status:'working', accent:'#f97316',  focus:'AI协作平台与 Agent Runtime',           current:'移动端 Alpha 迭代'},
  {id:'kaifa',  name:'开发',    role:'Codex 开发 Bot',    status:'idle',    accent:'#4ade80',  focus:'代码、构建、Bug 修复',                current:'等待构建/接口任务'},
];

// ─── Mock Tasks ───────────────────────────────────────────────────────────────
export const tasksMock: Task[] = [
  {id:'t1', title:'移动端 P0：AI 大脑总览',     owner:'助理 / 黑金', state:'running', eta:'今晚',    next:'补齐总览、记忆库、调度链 UI', priority:'P0'},
  {id:'t2', title:'OpenClaw Bridge 接口骨架', owner:'开发',           state:'todo',    eta:'明天',    next:'接真实 Agent/任务/消息 API',   priority:'P0'},
  {id:'t3', title:'附件上传入口',              owner:'黑金',           state:'running', eta:'Alpha 0.2',next:'图片、视频、文件统一进入 AI 指令流', priority:'P1'},
  {id:'t4', title:'APP 上架 Skill',           owner:'助理',           state:'done',    eta:'已完成',  next:'后续补 TestFlight 自动化',     priority:'P1'},
  {id:'t5', title:'Brave 搜索链路补丁验证',   owner:'助理',           state:'blocked', eta:'待二轮验证',next:'搜索链只作为研究辅助，不阻塞移动端', priority:'P2'},
  {id:'t6', title:'记忆库接口接入',           owner:'智联',           state:'todo',    eta:'本周',    next:'接 OpenClaw 记忆 API',         priority:'P1'},
  {id:'t7', title:'知识库全文检索',           owner:'智联',           state:'todo',    eta:'本周',    next:'接向量检索服务',                priority:'P1'},
];

// ─── Brain Stores (记忆库/知识库/附件/调度链) ───────────────────────────────
export const brainStoresMock: BrainStore[] = [
  {
    id:'memory', title:'记忆库', value:'长期 + 短期记忆',
    status:'active', detail:'用户偏好、项目决策、系统规则、历史判断',
    accent:'#a78bfa', screen:'MemoryStore',
  },
  {
    id:'knowledge', title:'知识库', value:'矿业 + 工程 + 技术',
    status:'active', detail:'钨矿、选矿、智慧矿山、AI 架构资料',
    accent:C.primary, screen:'KnowledgeBase',
  },
  {
    id:'project', title:'项目库', value:'AIBrainIM / 聚源三维',
    status:'active', detail:'移动端开发、智慧矿山、OpenClaw 修复链路',
    accent:'#34d399', screen:'ProjectLibrary',
  },
  {
    id:'file', title:'附件库', value:'图片 / 视频 / 文档',
    status:'pending', detail:'上传后交给助理判断并分派给对应 Agent',
    accent:'#f97316', screen:'FileLibrary',
  },
];

// ─── AI Feed (AI 产出流) ──────────────────────────────────────────────────────
// Fallback feed shown to end users when Gateway is not connected.
// User-appropriate: describes app value, not implementation details.
export const aiFeedMock: AIFeedItem[] = [
  {id:'f1', agent:'助理',    agentAccent:C.accent,    text:'发送一条指令，助理会立即接收并开始调度，结果实时回流到这里。', timestamp:'21:02', type:'output'},
  {id:'f2', agent:'助理',    agentAccent:C.accent,    text:'附件（图片、视频、文档）上传后会自动进入 AI 处理流程，无需手动分派。', timestamp:'21:04', type:'upload'},
  {id:'f3', agent:'助理',    agentAccent:C.accent,    text:'需要人工拍板的事项会停在这里等你决策，不会自动推进。', timestamp:'21:06', type:'confirmation'},
  {id:'f4', agent:'助理',    agentAccent:C.accent,    text:'记忆库和知识库会在对话中自动被引用，结果同步回流到首页。', timestamp:'21:08', type:'knowledge'},
];

// ─── Dispatch Chain ──────────────────────────────────────────────────────────
// User-appropriate trace shown when no real dispatches exist yet.
export const commandTraceMock: CommandTrace[] = [
  {stage:'receive',   title:'接收指令',  actor:'你 → 助理',             detail:'在「对话」中发送一条指令，助理立即接收并开始工作。'},
  {stage:'dispatch',  title:'智能调度',  actor:'助理',                   detail:'助理将指令拆解并分派给对应智能体执行，全程无需手动干预。'},
  {stage:'feedback',  title:'状态回流',  actor:'智能体',                detail:'执行状态实时回流到调度链和首页，不用刷新页面。'},
  {stage:'synthesis', title:'结果交付',  actor:'助理 / APP',            detail:'完成后结果自动同步到对话、任务流和首页 AI 产出流。'},
];

// ─── Confirmation Items (需确认项) ────────────────────────────────────────────
export const confirmationMock: ConfirmationItem[] = [
  {
    id:'c1', title:'是否接入 Brave 搜索？',
    description:'当前标记为研究辅助，不阻塞移动端主流程。可延后。',
    agent:'助理', urgency:'normal', timestamp:'20:28',
    status:'pending',
  },
  {
    id:'c2', title:'记忆库优先级确认',
    description:'长期记忆与短期记忆的存储策略需要确认。',
    agent:'智联', urgency:'high', timestamp:'20:20',
    status:'pending',
  },
  {
    id:'c3', title:'附件大小策略',
    description:'前端不设硬限制，请确认后端处理策略（分片/转码）。',
    agent:'黑金', urgency:'low', timestamp:'20:15',
    status:'pending',
  },
];

export const quickActionsMock = ['问总指挥','上传文件','看记忆库','查知识库','调开发','看任务','矿业分析','选矿判断'];
export const uploadTypesMock  = ['图片','视频','PDF/文档','压缩包','矿山资料','代码文件'];

// ─── Profile Stats ────────────────────────────────────────────────────────────
export const profileStatsMock: ProfileStats = {
  totalTasks: 12,
  completedTasks: 4,
  activeAgents: 5,
  memoryEntries: 128,
  knowledgeDocs: 342,
};
