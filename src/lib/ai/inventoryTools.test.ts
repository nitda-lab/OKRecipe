import { describe, it, expect } from 'vitest'
import { INVENTORY_TOOLS, executeTool, type PendingAction } from './inventoryTools'
import { InMemoryInventoryRepository } from '@/repositories/inMemoryInventoryRepository'

function makeRepo() {
  let n = 0
  return new InMemoryInventoryRepository({
    idFactory: () => `id-${++n}`,
    clock: () => '2026-06-23T00:00:00.000Z',
  })
}

function call(name: string, args: Record<string, unknown>) {
  return { id: 'tc1', type: 'function' as const, function: { name, arguments: JSON.stringify(args) } }
}

describe('INVENTORY_TOOLS', () => {
  it('exposes the inventory tools and save_recipe', () => {
    const names = INVENTORY_TOOLS.map((t) => t.function.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'add_inventory',
        'list_inventory',
        'remove_inventory',
        'update_inventory',
        'save_recipe',
      ]),
    )
  })
})

describe('executeTool', () => {
  it('list_inventory returns current items as JSON and does not touch pending', async () => {
    const repo = makeRepo()
    await repo.add('u1', { name: '卵', quantityText: '2個' })
    const pending: PendingAction[] = []
    const out = await executeTool(call('list_inventory', {}), { repo, userId: 'u1', pending })
    expect(out).toContain('卵')
    expect(pending).toHaveLength(0)
  })

  it('add_inventory records a pending add and does not write to repo', async () => {
    const repo = makeRepo()
    const pending: PendingAction[] = []
    const out = await executeTool(
      call('add_inventory', { name: '牛乳', qty_text: '1本' }),
      { repo, userId: 'u1', pending },
    )
    expect(pending).toEqual([{ type: 'add', name: '牛乳', quantityText: '1本' }])
    expect(await repo.list('u1')).toHaveLength(0)
    expect(out).toMatch(/確認/)
  })

  it('update_inventory records a pending update', async () => {
    const repo = makeRepo()
    const pending: PendingAction[] = []
    await executeTool(
      call('update_inventory', { id: 'id-9', qty_text: '1個' }),
      { repo, userId: 'u1', pending },
    )
    expect(pending).toEqual([{ type: 'update', id: 'id-9', quantityText: '1個' }])
  })

  it('remove_inventory records a pending remove', async () => {
    const repo = makeRepo()
    const pending: PendingAction[] = []
    await executeTool(call('remove_inventory', { id: 'id-9' }), { repo, userId: 'u1', pending })
    expect(pending).toEqual([{ type: 'remove', id: 'id-9' }])
  })

  it('save_recipe records a pending recipe save', async () => {
    const repo = makeRepo()
    const pending: PendingAction[] = []
    await executeTool(
      call('save_recipe', { title: 'オムレツ', body: '## 材料\n卵2個' }),
      { repo, userId: 'u1', pending },
    )
    expect(pending).toEqual([{ type: 'save_recipe', title: 'オムレツ', body: '## 材料\n卵2個' }])
  })

  it('throws on unknown tool', async () => {
    const repo = makeRepo()
    await expect(
      executeTool(call('frobnicate', {}), { repo, userId: 'u1', pending: [] }),
    ).rejects.toThrow()
  })
})
