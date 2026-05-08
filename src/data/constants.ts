/**
 * Design Tokens — shared across all screens and components.
 * Extracted from mockData.ts to follow single-responsibility principle.
 * mockData.ts now only contains seed data, not design system values.
 */

// ─── Design Tokens ─────────────────────────────────────────────────────────────
export const C = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  bgRoot:      '#030810',
  bgSurface:   '#080e1a',
  bgCard:      'rgba(14,24,42,0.7)',
  bgElevated:  '#0d1830',
  bgOverlay:   'rgba(8,14,28,0.85)',

  // ── Borders ──────────────────────────────────────────────────────────────
  borderSubtle:  'rgba(255,255,255,0.06)',
  borderDefault: 'rgba(255,255,255,0.10)',
  borderActive:  'rgba(56,189,248,0.5)',

  // ── Accent / Primary ─────────────────────────────────────────────────────
  primary:     '#38bdf8',
  primaryDark: '#0284c7',
  primaryGlow: 'rgba(56,189,248,0.25)',
  accent:      '#22d3ee',

  // ── Text ─────────────────────────────────────────────────────────────────
  textPrimary:   '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted:     '#475569',
  textDisabled:  '#1e293b',
  textTitle:     '#f1f5f9',
  textBody:      '#cbd5e1',
  textDim:       '#334155',

  // ── Status ────────────────────────────────────────────────────────────────
  success:   '#34d399',
  warning:   '#fbbf24',
  error:     '#f87171',
  info:      '#60a5fa',

  // ── Agent platform colours ────────────────────────────────────────────────
  zhuli:    '#22d3ee',
  renzhi:   '#a78bfa',
  xunlong:  '#fbbf24',
  wuyin:    '#34d399',
  tansuo:   '#fb7185',
  zhilian:  '#38bdf8',
  heijin:   '#f97316',
  kaifa:    '#4ade80',

  // ── Runtime / Agent status ─────────────────────────────────────────────────
  online:       '#22d3ee',
  working:      '#38bdf8',
  idle:         '#94a3b8',
  watching:     '#818cf8',
  stateRunning: '#1d4ed8',
  stateTodo:    '#1e293b',
  stateDone:    '#065f46',
  stateBlocked: '#881337',

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBg:       'rgba(5,13,26,0.92)',
  tabActive:   '#38bdf8',
  tabInactive: '#64748b',

  // ── Urgency ────────────────────────────────────────────────────────────────
  highUrgency:  '#f87171',
  normalUrgency:'#fbbf24',
  lowUrgency:   '#34d399',

  // ── Legacy aliases (for compatibility during migration) ────────────────────
  bgGlass:     'rgba(14,24,42,0.65)',
  borderGlass: 'rgba(255,255,255,0.08)',
} as const;
