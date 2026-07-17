/**
 * Design Tokens — Meridian OS v4
 * 针对 iPhone 17 Pro Max（6.9寸, 430×932pt @3x）全面精校
 *
 * 设计哲学：
 * - 大屏优先：大字体、高对比度、大触控目标
 * - 精致感：圆角统一16px、极细1px描边、柔和光晕
 * - 层次感：4px精细间距网格、8pt基础间距系统
 * - 呼吸感：充足内边距、宽松行高、清晰的视觉层级
 */

export const C = {
  // ── Backgrounds — 海军蓝渐变层次 ─────────────────────────────────────
  bgRoot:      '#07090E',   // 根底：最深（比纯黑更沉静）
  bgSurface:   '#0C0F16',   // 表面层
  bgCard:      '#141820',   // 卡片：比旧值#171C26更内敛
  bgElevated:  '#1A2030',   // 抬升元素
  bgOverlay:   'rgba(7,9,14,0.92)',
  bgGlass:     'rgba(20,24,32,0.80)',

  // ── Borders — 极细1px描边，视觉无重量 ───────────────────────────────
  borderSubtle:  'rgba(255,255,255,0.04)',
  borderDefault: 'rgba(255,255,255,0.08)',
  borderActive:  'rgba(77,255,136,0.50)',

  // ── Primary — 霓虹绿主色 ────────────────────────────────────────────
  primary:     '#4DFF88',
  primaryDark: '#3DD974',
  primaryGlow: 'rgba(77,255,136,0.18)',
  primarySoft: 'rgba(77,255,136,0.10)',
  accent:      '#3DD974',

  // ── Ambient Glow — 氛围光 ───────────────────────────────────────────
  glowGreen: 'rgba(77,255,136,0.08)',
  glowBlue:  'rgba(20,40,80,0.35)',

  // ── Text — 三级灰度，清晰层次 ──────────────────────────────────────
  textPrimary:   '#FFFFFF',
  textSecondary: '#A8B4C4',  // 比旧值#94A3B8略亮，减少阅读疲劳
  textMuted:     '#5C6A7E',  // 比旧值#64748B更深，层次更分明
  textDisabled:  '#1E2535',
  textTitle:     '#FFFFFF',
  textBody:      '#A8B4C4',

  // ── Status ─────────────────────────────────────────────────────────────
  success:   '#4DFF88',
  warning:   '#F5C842',
  error:     '#FF4D6A',
  info:      '#38BDF8',

  // ── Agent Colors ──────────────────────────────────────────────────────
  zhuli:    '#4DFF88',
  renzhi:   '#B08BFF',
  xunlong:  '#FFD84D',
  wuyin:    '#4DFF88',
  tansuo:   '#FF7096',
  zhilian:  '#38BDF8',
  heijin:   '#FF9F45',
  kaifa:    '#52F0A8',

  // ── Status aliases ─────────────────────────────────────────────────────
  working:  '#F5C842',
  idle:     '#5C6A7E',
  low:      '#FF9F45',
  highUrgency: '#FF4D6A',
  online:       '#4DFF88',
  watching:     '#B08BFF',
  stateRunning: '#4DFF88',
  stateTodo:    '#5C6A7E',
  stateDone:    '#4DFF88',
  stateBlocked: '#FF4D6A',
  normalUrgency:'#F5C842',
  lowUrgency:   '#4DFF88',

  // ── Tab Bar ───────────────────────────────────────────────────────────
  tabBg:       '#0A0D14',
  tabActive:   '#4DFF88',
  tabInactive: '#4A5568',
  tabDivider:  'rgba(255,255,255,0.04)',
} as const;

// ─── Typography — 精修层级，iPhone 17 Pro Max 屏幕优化 ─────────────────────
/*
 * iPhone 17 Pro Max: 430×932pt @3x
 * 最佳阅读行宽：320-380pt（每行35-45字）
 * 触控目标最小：44×44pt（Apple HIG标准）
 */
export const TYPO = {
  hero:     {fontSize: 34, fontWeight: '800' as const, lineHeight: 42},
  h1:       {fontSize: 24, fontWeight: '700' as const, lineHeight: 32},
  h2:       {fontSize: 20, fontWeight: '600' as const, lineHeight: 28},
  h3:       {fontSize: 17, fontWeight: '600' as const, lineHeight: 24},
  bigNum:   {fontSize: 40, fontWeight: '800' as const, lineHeight: 48},
  bigNumSm: {fontSize: 32, fontWeight: '800' as const, lineHeight: 40},
  body:      {fontSize: 16, fontWeight: '400' as const, lineHeight: 24},
  bodyBold:  {fontSize: 16, fontWeight: '600' as const, lineHeight: 24},
  bodySm:    {fontSize: 15, fontWeight: '400' as const, lineHeight: 22},
  subtitle:  {fontSize: 14, fontWeight: '500' as const, lineHeight: 20},
  caption:   {fontSize: 13, fontWeight: '400' as const, lineHeight: 18},
  captionBold:{fontSize: 13, fontWeight: '600' as const, lineHeight: 18},
  label:     {fontSize: 12, fontWeight: '600' as const, lineHeight: 16},
  micro:     {fontSize: 11, fontWeight: '600' as const, lineHeight: 14},
  statNum:   {fontSize: 28, fontWeight: '700' as const, lineHeight: 36},
  statNumSm: {fontSize: 20, fontWeight: '700' as const, lineHeight: 28},
} as const;

// ─── Layout — 8pt 精细网格系统 ──────────────────────────────────────────────
/*
 * iPhone 17 Pro Max 有效内容区：约 430pt 宽，932pt 高
 * TabBar 高度：64pt（HIG推荐最小触控区）
 * SafeArea 顶部：约 47pt（刘海区）
 * SafeArea 底部：约 34pt（Home Indicator）
 * 可用内容高度：932 - 47 - 34 - 64 ≈ 787pt
 */
export const LAYOUT = {
  pageMargin:  18,
  sectionGap:  24,
  cardGap:     12,
  cardPadding: 18,
  cardRadius:   16,
  cardRadiusSm: 10,
  cardRadiusXs: 6,
  borderWidth:  1,
  borderWidth2: 2,
  minTapTarget: 44,
  tabBarHeight: 64,
  safeAreaTop:    47,
  safeAreaBottom: 34,
} as const;
