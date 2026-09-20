export const INSTRUMENT_COLORS = {
  piano: '#6366f1',
  teclado: '#6366f1',
  guitarra: '#f59e0b',
  violín: '#ef4444',
  violin: '#ef4444',
  canto: '#ec4899',
  voz: '#ec4899',
  batería: '#8b5cf6',
  bateria: '#8b5cf6',
  bajo: '#06b6d4',
  flauta: '#22c55e',
  saxofon: '#f97316',
  saxofón: '#f97316',
  trompeta: '#eab308',
  ukelele: '#14b8a6',
  percusion: '#a855f7',
  percusión: '#a855f7',
  default: '#14b8a6',
}

export const getInstrumentColor = (instrument) => {
  if (!instrument) return INSTRUMENT_COLORS.default
  const key = instrument
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return INSTRUMENT_COLORS[key] || INSTRUMENT_COLORS.default
}

export const LEAGUE_COLORS = {
  bronce: '#cd7f32',
  plata: '#c0c0c0',
  oro: '#ffd700',
  diamante: '#b9f2ff',
}

export const LEAGUE_ICONS = {
  bronce: '🥉',
  plata: '🥈',
  oro: '🥇',
  diamante: '💎',
}

export const BADGE_COLORS = {
  warning: '#f59e0b',
  info: '#06b6d4',
  primary: '#6366f1',
  success: '#22c55e',
  danger: '#ef4444',
  magenta: '#ec4899',
  purple: '#8b5cf6',
  dark: '#374151',
  secondary: '#64748b',
}
