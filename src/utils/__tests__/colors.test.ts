import { describe, it, expect } from 'vitest'
import {
  INSTRUMENT_COLORS,
  getInstrumentColor,
  LEAGUE_COLORS,
  LEAGUE_ICONS,
  BADGE_COLORS,
} from '../colors'

describe('getInstrumentColor', () => {
  it('returns the default for falsy input', () => {
    expect(getInstrumentColor()).toBe(INSTRUMENT_COLORS.default)
    expect(getInstrumentColor('')).toBe(INSTRUMENT_COLORS.default)
  })

  it('is case insensitive', () => {
    expect(getInstrumentColor('PIANO')).toBe(INSTRUMENT_COLORS.piano)
  })

  it('ignores accents', () => {
    expect(getInstrumentColor('Saxofón')).toBe(INSTRUMENT_COLORS.saxofon)
    expect(getInstrumentColor('Violín')).toBe(INSTRUMENT_COLORS.violin)
  })

  it('falls back to the default for unknown instruments', () => {
    expect(getInstrumentColor('Theremin')).toBe(INSTRUMENT_COLORS.default)
  })
})

describe('palettes', () => {
  it('defines the four leagues', () => {
    expect(Object.keys(LEAGUE_COLORS)).toEqual(['bronce', 'plata', 'oro', 'diamante'])
    expect(LEAGUE_COLORS.oro).toBe('#ffd700')
    expect(LEAGUE_ICONS.diamante).toBe('💎')
  })

  it('defines badge colors', () => {
    expect(BADGE_COLORS.success).toBe('#22c55e')
  })
})
