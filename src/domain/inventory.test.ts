import { describe, it, expect } from 'vitest'
import { buildInventoryItem, applyQuantityChange } from './inventory'

const ctx = { id: 'item-1', userId: 'user-1', now: '2026-06-23T00:00:00.000Z' }

describe('buildInventoryItem', () => {
  it('fills derived quantity fields from text', () => {
    const item = buildInventoryItem({ name: '卵', quantityText: '2個' }, ctx)
    expect(item).toEqual({
      id: 'item-1',
      userId: 'user-1',
      name: '卵',
      quantityText: '2個',
      quantityNum: 2,
      unitText: '個',
      expiresAt: null,
      source: 'manual',
      updatedAt: '2026-06-23T00:00:00.000Z',
    })
  })

  it('defaults source to manual and expiresAt to null', () => {
    const item = buildInventoryItem({ name: 'にんじん', quantityText: '一人前分' }, ctx)
    expect(item.source).toBe('manual')
    expect(item.expiresAt).toBeNull()
    expect(item.quantityNum).toBeNull()
  })

  it('respects an explicit source and expiry', () => {
    const item = buildInventoryItem(
      { name: '牛乳', quantityText: '1本', source: 'receipt', expiresAt: '2026-06-30' },
      ctx,
    )
    expect(item.source).toBe('receipt')
    expect(item.expiresAt).toBe('2026-06-30')
  })
})

describe('applyQuantityChange', () => {
  it('updates text, derived fields and updatedAt', () => {
    const item = buildInventoryItem({ name: '卵', quantityText: '2個' }, ctx)
    const updated = applyQuantityChange(item, '1個', '2026-06-24T00:00:00.000Z')
    expect(updated.quantityText).toBe('1個')
    expect(updated.quantityNum).toBe(1)
    expect(updated.updatedAt).toBe('2026-06-24T00:00:00.000Z')
    expect(updated.id).toBe(item.id)
  })
})
