/**
 * Design Tokens — Industrial Intelligence OS (Final Design v3)
 * Based on reference screenshots: dual ambient glow + glass-morphism + electric green accent
 *
 * 设计语言：工业智能操作系统
 * 背景：深炭黑 #0D0D0D + 双色氛围光（翠绿右上角 + 深蓝左下角）
 * 主色：荧光绿 #00FF41（激活态 / CTA / 状态点）
 * 卡片：玻璃拟态半透明深灰面板，12-16px大圆角
 */

// ─── Design Tokens ───────────────────────────────────────────────────────────────
export const C = {
  // ── Backgrounds — 深炭黑 + 氛围光 ──────────────────────────────────────────
  bgRoot:      '#0D0D0D',        // 深炭黑底
  bgSurface:   '#141414',        // 次层背景
  bgCard:      'rgba(20,20,20,0.85)',  // 玻璃拟态卡片
  bgElevated:  '#1A1A1A',        // 抬升元素
  bgOverlay:   'rgba(13,13,13,0.92)',
  bgGlass:     'rgba(20,20,20,0.70)',

  // ── Borders — 极淡绿色描边 ───────────────────────────────────────────────
  borderSubtle:  'rgba(255,255,255,0.06)',
  borderDefault:  'rgba(255,255,255,0.10)',
  borderActive:  'rgba(0,255,65,0.60)',

  // ── Accent / Primary — 荧光绿 ──────────────────────────────────────────────
  primary:     '#00FF41',        // 荧光绿（激活态 / CTA / 状态点）
  primaryDark: '#00CC33',
  primaryGlow: 'rgba(0,255,65,0.20)',
  accent:      '#00D97A',         // 薄荷绿点缀

  // ── Ambient Glow Colors ──────────────────────────────────────────────────
  glowGreen:  'rgba(0,255,65,0.08)',   // 右上角翠绿光晕
  glowBlue:   'rgba(30,80,200,0.06)',  // 左下角深蓝光晕

  // ── Text ─────────────────────────────────────────────────────────────────
  textPrimary:   '#FFFFFF',
  textSecondary: '#d4d4d4',
  textMuted:     '#555555',
  textDisabled:  '#222222',
  textTitle:     '#FFFFFF',
  textBody:      '#d4d4d4',

  // ── Status ────────────────────────────────────────────────────────────────
  success:   '#00FF41',
  warning:   '#FFD700',
  error:     '#FF3B3B',
  info:      '#00BFFF',

  // ── Agent platform colours ────────────────────────────────────────────────
  zhuli:    '#00FF41',
  renzhi:   '#B366FF',
  xunlong:  '#FFD700',
  wuyin:    '#00FF9F',
  tansuo:   '#FF7185',
  zhilian:  '#00BFFF',
  heijin:   '#FF9100',
  kaifa:    '#39FF14',

  // ── Convenience aliases ─────────────────────────────────────────────────
  working:  '#FFD700',
  idle:     '#555555',
  low:      '#FF9100',
  highUrgency: '#FF3B3B',

  // ── Status badge aliases ───────────────────────────────────────────────
  online:       '#00FF41',
  watching:     '#B366FF',
  stateRunning: '#1d4ed8',
  stateTodo:    '#1e293b',
  stateDone:    '#065f46',
  stateBlocked: '#881337',
  normalUrgency:'#fbbf24',
  lowUrgency:   '#34d399',

  // ── Tab Bar ───────────────────────────────────────────────────────────────
  tabBg:      '#0D0D0D',
  tabActive:  '#00FF41',
  tabInactive: '#6B7280',
  tabDivider:  'rgba(255,255,255,0.08)',
} as const;

// ─── Typography helpers ──────────────────────────────────────────────────────────
export const TYPO = {
  hero:  {fontSize: 28, fontWeight: '900' as const, lineHeight: 34},
  h1:    {fontSize: 24, fontWeight: '800' as const, lineHeight: 31},
  h2:    {fontSize: 20, fontWeight: '800' as const, lineHeight: 28},
  h3:    {fontSize: 17, fontWeight: '700' as const, lineHeight: 25},
  body:  {fontSize: 15, fontWeight: '400' as const, lineHeight: 24},
  bodySmall: {fontSize: 14, fontWeight: '400' as const, lineHeight: 22},
  caption: {fontSize: 12, fontWeight: '500' as const, lineHeight: 18},
  micro:  {fontSize: 11, fontWeight: '600' as const, lineHeight: 15},
} as const;
