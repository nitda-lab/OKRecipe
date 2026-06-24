import { describe, it, expect } from 'vitest'
import { InMemoryMemoryRepository } from './inMemoryMemoryRepository'

function makeRepo() {
  let n = 0
  return new InMemoryMemoryRepository({ idFactory: () => `m-${++n}`, clock: () => '2026-06-24T00:00:00.000Z' })
}

describe('InMemoryMemoryRepository', () => {
  it('creates and lists memories for the user', async () => {
    const repo = makeRepo()
    const m = await repo.create('u1', '揚げ物は面倒')
    expect(m.id).toBe('m-1')
    expect(m.text).toBe('揚げ物は面倒')
    expect(await repo.list('u1')).toHaveLength(1)
  })
  it('removes a memory', async () => {
    const repo = makeRepo()
    const m = await repo.create('u1', 'えびアレルギー')
    await repo.remove('u1', m.id)
    expect(await repo.list('u1')).toHaveLength(0)
  })
  it('isolates per user', async () => {
    const repo = makeRepo()
    await repo.create('u1', 'a')
    expect(await repo.list('u2')).toHaveLength(0)
  })
  it('does not let another user delete a memory', async () => {
    const repo = makeRepo()
    const m = await repo.create('u1', 'a')
    await expect(repo.remove('u2', m.id)).rejects.toThrow()
  })
})
