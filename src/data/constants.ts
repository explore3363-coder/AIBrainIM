/**
 * Design Tokens — Meridian Industrial OS v3
 * 基于用户定稿参考图（2026-05-20）精校
 *
 * 背景: #080A0F ~ #12171F 深海军蓝渐变（不是纯黑）
 * 主色: #4DFF88 暖调霓虹绿（参考图标准，不是#00FF00也不是#36FB8B）
 * 卡片: #171C26 圆角24px 边框rgba(255,255,255,0.06)
 * 文字: #FFFFFF / #94A3B8 / #64748B
 * 布局: 8px网格 / 页边距20px / 卡片间距16px / 卡片内边距20px
 * 字体层级: Hero 32pt ExtraBold / H1 22pt SemiBold / 大数字 36pt Bold
 */

export const C = {
  // ── Backgrounds — 深海军蓝底 + 双色氛围光 ─────────────────────────────
  bgRoot:      '#080A0F',   // 深海军蓝主底（比纯黑更有层次）
  bgSurface:   '#0D1117',   // 次层背景
  bgCard:      '#171C26',   // 卡片背景（灰蓝层次）
  bgElevated:  '#1E2530',   // 抬升元素
  bgOverlay:   'rgba(8,10,15,0.92)',
  bgGlass:     'rgba(23,28,38,0.75)',

  // ── Borders — 极细描边 ───────────────────────────────────────────────
  borderSubtle:  'rgba(255,255,255,0.05)',
  borderDefault: '#2D3748',   // 卡片边框 1px（参考图）
  borderActive:  '#4DFF88',

  // ── Accent / Primary — 暖调霓虹绿 ─────────────────────────────────────
  primary:     '#4DFF88',      // 暖调霓虹绿主色（参考图标准）
  primaryDark: '#3DE077',
  primaryGlow: 'rgba(77,255,136,0.25)',
  accent:      '#3DE077',       // 薄荷绿（次要强调）

  // ── Ambient Glow ───────────────────────────────────────────────────────
  glowGreen:  'rgba(77,255,136,0.12)',  // 右上角暖绿光晕
  glowBlue:   'rgba(26,34,53,0.40)',     // 左下角深蓝光晕

  // ── Text ───────────────────────────────────────────────────────────────
  textPrimary:   '#FFFFFF',   // 一级标题
  textSecondary: '#94A3B8',  // 二级标题/英文（参考图标准）
  textMuted:     '#64748B',  // 辅助/注释（参考图标准）
  textDisabled:  '#1E2530',
  textTitle:     '#FFFFFF',
  textBody:      '#94A3B8',

  // ── Status ──────────────────────────────────────────────────────────────
  success:   '#4DFF88',
  warning:   '#FAD06B',       // 淡黄（待接入状态）
  error:     '#FF3B3B',
  info:      '#00BFFF',

  // ── Agent Colors ───────────────────────────────────────────────────────
  zhuli:    '#4DFF88',
  renzhi:   '#B366FF',
  xunlong:  '#FFD700',
  wuyin:    '#4DFF88',
  tansuo:   '#FF7185',
  zhilian:  '#00BFFF',
  heijin:   '#FF9100',
  kaifa:    '#39FF14',

  // ── Status aliases ──────────────────────────────────────────────────
  working:  '#FAD06B',
  idle:     '#64748B',
  low:      '#FF9100',
  highUrgency: '#FF3B3B',

  online:       '#4DFF88',
  watching:     '#B366FF',
  stateRunning: '#4DFF88',
  stateTodo:    '#64748B',
  stateDone:    '#4DFF88',
  stateBlocked: '#FF3B3B',
  normalUrgency:'#FAD06B',
  lowUrgency:   '#4DFF88',

  // ── Tab Bar ───────────────────────────────────────────────────────────
  tabBg:      '#0D1117',
  tabActive:  '#4DFF88',
  tabInactive: '#64748B',
  tabDivider:  'rgba(255,255,255,0.05)',
} as const;

// ─── Typography — 参考图层级 ─────────────────────────────────────────────────
export const TYPO = {
  hero:  {fontSize: 32, fontWeight: '800' as const, lineHeight: 40},  // 主标题（参考图32pt ExtraBold）
  h1:    {fontSize: 22, fontWeight: '700' as const, lineHeight: 30},
  h2:    {fontSize: 18, fontWeight: '600' as const, lineHeight: 26},
  h3:    {fontSize: 16, fontWeight: '600' as const, lineHeight: 24},
  bigNum:{fontSize: 36, fontWeight: '800' as const, lineHeight: 44},  // 大数字（参考图68%）
  body:  {fontSize: 16, fontWeight: '400' as const, lineHeight: 24},
  bodySmall: {fontSize: 14, fontWeight: '400' as const, lineHeight: 22},
  caption: {fontSize: 12, fontWeight: '400' as const, lineHeight: 18},
  micro:  {fontSize: 10, fontWeight: '600' as const, lineHeight: 14},
} as const;

// ─── Layout Constants — 8px网格系统 ─────────────────────────────────────
export const LAYOUT = {
  pageMargin: 20,      // 页边距（参考图20px）
  cardRadius: 24,      // 大卡片圆角（参考图24px，不是32px）
  cardRadiusSmall: 12, // 按钮/小元素圆角（参考图12px）
  cardPadding: 20,    // 卡片内边距（参考图20px）
  cardGap: 16,        // 卡片间距（参考图16px）
  borderWidth: 1,     // 边框宽度
} as const;
