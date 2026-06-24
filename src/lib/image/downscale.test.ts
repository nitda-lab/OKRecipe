import { describe, it, expect } from 'vitest'
import { fitWithin } from './downscale'

describe('fitWithin', () => {
  it('keeps dimensions when both sides are within max', () => {
    expect(fitWithin(800, 600, 1568)).toEqual({ width: 800, height: 600 })
  })
  it('scales down preserving aspect ratio when the long side exceeds max', () => {
    expect(fitWithin(4000, 3000, 1568)).toEqual({ width: 1568, height: 1176 })
  })
  it('handles portrait orientation (height is the long side)', () => {
    expect(fitWithin(3000, 4000, 1568)).toEqual({ width: 1176, height: 1568 })
  })
})
