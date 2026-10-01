import { describe, expect, it } from 'vitest'
import { clampTokenValues, contrastRatio, diffDirty, hasDirtyFlags, validateTokens } from '../domain/brandRules'
import { INITIAL_TOKENS } from '../models/brandMirrorModels'

describe('brand token rules', () => {
  it('calculates a readable contrast ratio', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1)
    expect(contrastRatio('#F15A47', '#24324A')).toBeGreaterThan(3)
  })

  it('clamps extreme values to the supported design scale', () => {
    const clamped = clampTokenValues({ ...INITIAL_TOKENS, typeScale: [1, 80, 14, 20, 28, 40], radiusScale: [-4, 12, 18, 50], spacingScale: [0, 8, 12, 20, 99] })
    expect(clamped.typeScale).toEqual([10, 72, 14, 20, 28, 40])
    expect(clamped.radiusScale).toEqual([0, 12, 18, 40])
    expect(clamped.spacingScale).toEqual([2, 8, 12, 20, 64])
  })

  it('rejects invalid colors and unsupported scale lengths', () => {
    expect(validateTokens({ ...INITIAL_TOKENS, primary: 'red' })).toContain('HEX')
    expect(validateTokens({ ...INITIAL_TOKENS, typeScale: [12] })).toContain('数量')
  })

  it('marks exactly the token groups that differ from the persisted baseline', () => {
    const persisted = { tokens: { ...INITIAL_TOKENS }, theme: 'studio' as const }
    const working = {
      tokens: { ...INITIAL_TOKENS, primary: '#123456', typeScale: [18, 14, 16, 20, 28, 40] },
      theme: 'night' as const,
    }
    const dirty = diffDirty(working, persisted)
    expect(dirty.theme).toBe(true)
    expect(dirty.primary).toBe(true)
    expect(dirty.typeScale).toBe(true)
    expect(dirty.secondary).toBe(false)
    expect(dirty.radiusScale).toBe(false)
    expect(dirty.spacingScale).toBe(false)
    expect(hasDirtyFlags({ ...dirty, versions: false })).toBe(true)
    expect(hasDirtyFlags({ theme: false, primary: false, secondary: false, radiusScale: false, spacingScale: false, typeScale: false, versions: false })).toBe(false)
  })
})
