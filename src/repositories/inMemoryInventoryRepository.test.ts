import { describe, it, expect } from 'vitest'
import { InMemoryInventoryRepository } from './inMemoryInventoryRepository'

function makeRepo() {
  let n = 0
  return new InMemoryInventoryRepository({
    idFactory: () => `id-${++n}`,
    clock: () => '2026-06-23T00:00:00.000Z',
  })
}

describe('InMemoryInventoryRepository', () => {
  it('adds and lists items per user', async () => {
    const repo = makeRepo()
    await repo.add('u1', { name: '卵', quantityText: '2個' })
    await repo.add('u2', { name: '牛乳', quantityText: '1本' })
    const u1 = await repo.list('u1')
    expect(u1).toHaveLength(1)
    expect(u1[0].name).toBe('卵')
  })

  it('updates quantity of an existing item', async () => {
    const repo = makeRepo()
    const added = await repo.add('u1', { name: '卵', quantityText: '2個' })
    const updated = await repo.updateQuantity('u1', added.id, '1個')
    expect(updated.quantityText).toBe('1個')
    expect((await repo.list('u1'))[0].quantityText).toBe('1個')
  })

  it('removes an item', async () => {
    const repo = makeRepo()
    const added = await repo.add('u1', { name: '卵', quantityText: '2個' })
    await repo.remove('u1', added.id)
    expect(await repo.list('u1')).toHaveLength(0)
  })

  it('does not let one user touch another user item', async () => {
    const repo = makeRepo()
    const added = await repo.add('u1', { name: '卵', quantityText: '2個' })
    await expect(repo.updateQuantity('u2', added.id, '1個')).rejects.toThrow()
  })
})
