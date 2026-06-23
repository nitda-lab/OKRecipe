import { describe, it, expect } from 'vitest'
import { parseQuantity } from './quantity'

describe('parseQuantity', () => {
  it('keeps the original text always', () => {
    expect(parseQuantity('一人前分').text).toBe('一人前分')
  })

  it('extracts a leading number and unit', () => {
    expect(parseQuantity('2個')).toEqual({ text: '2個', num: 2, unit: '個' })
  })

  it('handles full-width digits', () => {
    expect(parseQuantity('３本')).toEqual({ text: '３本', num: 3, unit: '本' })
  })

  it('returns null num/unit when no number present', () => {
    expect(parseQuantity('残り半分')).toEqual({ text: '残り半分', num: null, unit: '残り半分' })
  })

  it('trims surrounding whitespace in text', () => {
    expect(parseQuantity('  3パック ').text).toBe('3パック')
  })
})
