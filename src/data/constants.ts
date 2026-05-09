/**
 * Design Tokens — Industrial Intelligence OS
 * 一比一还原参考截图设计规范
 * 参考截图1: Library界面 (深炭黑+双色氛围光+玻璃拟态)
 * 参考截图2: Dashboard界面 (Industrial OS Command Center)
 *
 * 背景: #0B0E14 深炭黑底 + #26C96C右上翠绿光晕(#26C96C 15%) + #1A2235左下深蓝光晕
 * 卡片: #11141B 圆角32px 边框#1F242C(1px)
 * 主色: #36FB8B 荧光绿
 * 文字: #FFFFFF / #8E9BA7 / #5C6672
 * 页边距: 20px / 卡片间距: 16px / 卡片内边距: 20px
 */

export const C = {
  // ── Backgrounds — 深炭黑底 + 双色氛围光 ────────────────────────────────
  bgRoot:      '#0B0E14',   // 深炭黑主底
  bgSurface:   '#11141B',   // 卡片背景色
  bgCard:      '#11141B',   // 玻璃拟态卡片
  bgElevated:  '#1A212A',   // 抬升元素（比卡片略浅）
  bgOverlay:   'rgba(11,14,20,0.92)',
  bgGlass:     'rgba(17,20,27,0.70)',

  // ── Borders — 极细描边 ───────────────────────────────────────────────
  borderSubtle:  'rgba(255,255,255,0.06)',
  borderDefault: '#1F242C',   // 卡片边框 1px
  borderActive:  '#36FB8B',

  // ── Accent / Primary — 荧光绿 ──────────────────────────────────────────
  primary:     '#36FB8B',      // 荧光绿主色
  primaryDark: '#26C96C',
  primaryGlow: 'rgba(54,251,139,0.20)',
  accent:      '#26C96C',       // 薄荷绿（次要强调）

  // ── Ambient Glow ───────────────────────────────────────────────────────
  glowGreen:  'rgba(38,201,108,0.15)',  // 右上角翠绿光晕
  glowBlue:   'rgba(26,34,53,0.50)',     // 左下角深蓝光晕

  // ── Text ───────────────────────────────────────────────────────────────
  textPrimary:   '#FFFFFF',   // 一级标题
  textSecondary: '#8E9BA7',  // 二级标题/英文
  textMuted:     '#5C6672',  // 辅助/注释
  textDisabled:  '#222222',
  textTitle:     '#FFFFFF',
  textBody:      '#8E9BA7',

  // ── Status ──────────────────────────────────────────────────────────────
  success:   '#36FB8B',
  warning:   '#FAD06C',       // 淡黄（待接入状态）
  error:     '#FF3B3B',
  info:      '#00BFFF',

  // ── Agent Colors ───────────────────────────────────────────────────────
  zhuli:    '#36FB8B',
  renzhi:   '#B366FF',
  xunlong:  '#FFD700',
  wuyin:    '#36FB8B',
  tansuo:   '#FF7185',
  zhilian:  '#00BFFF',
  heijin:   '#FF9100',
  kaifa:    '#39FF14',

  // ── Status aliases ──────────────────────────────────────────────────
  working:  '#FAD06C',
  idle:     '#5C6672',
  low:      '#FF9100',
  highUrgency: '#FF3B3B',

  online:       '#36FB8B',
  watching:     '#B366FF',
  stateRunning: '#36FB8B',
  stateTodo:    '#5C6672',
  stateDone:    '#26C96C',
  stateBlocked: '#FF3B3B',
  normalUrgency:'#FAD06C',
  lowUrgency:   '#36FB8B',

  // ── Tab Bar ───────────────────────────────────────────────────────────
  tabBg:      '#0B0E14',
  tabActive:  '#36FB8B',
  tabInactive: '#5C6672',
  tabDivider:  'rgba(255,255,255,0.06)',
} as const;

// ─── Typography ──────────────────────────────────────────────────────────
export const TYPO = {
  hero:  {fontSize: 24, fontWeight: '700' as const, lineHeight: 32},  // 主标题
  h1:    {fontSize: 20, fontWeight: '700' as const, lineHeight: 28},
  h2:    {fontSize: 18, fontWeight: '600' as const, lineHeight: 26},
  h3:    {fontSize: 16, fontWeight: '600' as const, lineHeight: 24},
  body:  {fontSize: 16, fontWeight: '400' as const, lineHeight: 24},
  bodySmall: {fontSize: 14, fontWeight: '400' as const, lineHeight: 22},
  caption: {fontSize: 12, fontWeight: '400' as const, lineHeight: 18},
  micro:  {fontSize: 10, fontWeight: '600' as const, lineHeight: 14},
} as const;

// ─── Layout Constants ───────────────────────────────────────────────────
export const LAYOUT = {
  pageMargin: 20,      // 页边距
  cardRadius: 32,      // 大卡片圆角
  cardRadiusSmall: 16, // 按钮/小元素圆角
  cardPadding: 20,     // 卡片内边距
  cardGap: 16,         // 卡片间距
  borderWidth: 1,      // 边框宽度
} as const;
