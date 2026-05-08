/**
 * Design Tokens — 霓虹绿工业 OS v2.0
 *
 * 设计语言：Industrial Intelligence OS
 * 背景：纯黑 OLED 友好
 * 主色：霓虹绿 #00FF00
 */

// ─── Design Tokens ───────────────────────────────────────────────────────────────
export const C = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  bgRoot:      '#000000',        // 纯黑 OLED
  bgSurface:   '#0a0a0a',        // 次层背景
  bgCard:      'rgba(20,20,20,0.85)',
  bgElevated:  '#111111',
  bgOverlay:   'rgba(0,0,0,0.92)',
  bgGlass:     'rgba(20,20,20,0.70)',

  // ── Borders ─────────────────────────────────────────────────────────────
  borderSubtle:  'rgba(0,255,0,0.10)',
  borderDefault:  'rgba(0,255,0,0.18)',
  borderActive:  'rgba(0,255,0,0.60)',

  // ── Accent / Primary — 霓虹绿 ─────────────────────────────────────────────
  primary:     '#00FF00',
  primaryDark: '#00CC00',
  primaryGlow: 'rgba(0,255,0,0.20)',
  accent:      '#00FF9F',

  // ── Text ─────────────────────────────────────────────────────────────────
  textPrimary:   '#FFFFFF',
  textSecondary: '#d4d4d4',
  textMuted:     '#555555',
  textDisabled:  '#222222',
  textTitle:     '#FFFFFF',
  textBody:      '#d4d4d4',

  // ── Status ────────────────────────────────────────────────────────────────
  success:   '#00FF00',
  warning:   '#FFD700',
  error:     '#FF3B3B',
  info:      '#00BFFF',

  // ── Agent platform colours ────────────────────────────────────────────────
  zhuli:    '#00FF00',
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
  online:       '#00FF00',
  watching:     '#B366FF',
  stateRunning: '#1d4ed8',
  stateTodo:    '#1e293b',
  stateDone:    '#065f46',
  stateBlocked: '#881337',
  normalUrgency:'#fbbf24',
  lowUrgency:   '#34d399',

  // ── Tab Bar ───────────────────────────────────────────────────────────────
  tabBg:      '#0a0a0a',
  tabActive:  '#00FF00',
  tabInactive: '#555555',
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
