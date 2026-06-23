import { describe, it, expect } from 'vitest'
import { InMemoryRecipeRepository } from './inMemoryRecipeRepository'

function makeRepo() {
  let n = 0
  return new InMemoryRecipeRepository({ idFactory: () => `r-${++n}`, clock: () => '2026-06-23T00:00:00.000Z' })
}

describe('InMemoryRecipeRepository', () => {
  it('creates and lists recipes for the user', async () => {
    const repo = makeRepo()
    const r = await repo.create('u1', { title: 'オムレツ', body: '卵を焼く' })
    expect(r.id).toBe('r-1')
    const list = await repo.list('u1')
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('オムレツ')
  })
  it('gets a recipe by id', async () => {
    const repo = makeRepo()
    const r = await repo.create('u1', { title: 'A', body: 'b' })
    expect((await repo.get('u1', r.id))?.body).toBe('b')
  })
  it('removes a recipe', async () => {
    const repo = makeRepo()
    const r = await repo.create('u1', { title: 'A', body: 'b' })
    await repo.remove('u1', r.id)
    expect(await repo.list('u1')).toHaveLength(0)
  })
  it('isolates per user', async () => {
    const repo = makeRepo()
    await repo.create('u1', { title: 'A', body: 'b' })
    expect(await repo.list('u2')).toHaveLength(0)
    expect(await repo.get('u2', 'r-1')).toBeNull()
  })
})
