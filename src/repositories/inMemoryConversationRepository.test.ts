import { describe, it, expect } from 'vitest'
import { InMemoryConversationRepository } from './inMemoryConversationRepository'

function makeRepo() {
  let n = 0
  let t = 0
  return new InMemoryConversationRepository({
    idFactory: () => `c-${++n}`,
    clock: () => `2026-06-23T00:00:0${t++}.000Z`,
  })
}

describe('InMemoryConversationRepository', () => {
  it('creates a conversation and lists it for the user', async () => {
    const repo = makeRepo()
    const id = await repo.create('u1', 'ありもの相談')
    const list = await repo.list('u1')
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id, title: 'ありもの相談' })
  })

  it('appends messages and returns them in order', async () => {
    const repo = makeRepo()
    const id = await repo.create('u1', 't')
    await repo.appendMessages('u1', id, [
      { role: 'user', content: '在庫は？' },
      { role: 'assistant', content: '卵があります' },
    ])
    const msgs = await repo.getMessages('u1', id)
    expect(msgs).toEqual([
      { role: 'user', content: '在庫は？' },
      { role: 'assistant', content: '卵があります' },
    ])
  })

  it('orders conversations by most recently updated first', async () => {
    const repo = makeRepo()
    const a = await repo.create('u1', 'A')
    const b = await repo.create('u1', 'B')
    await repo.appendMessages('u1', a, [{ role: 'user', content: 'hi' }]) // a を後から更新
    const list = await repo.list('u1')
    expect(list.map((c) => c.id)).toEqual([a, b])
  })

  it('isolates conversations per user', async () => {
    const repo = makeRepo()
    await repo.create('u1', 'mine')
    await repo.create('u2', 'theirs')
    expect(await repo.list('u1')).toHaveLength(1)
  })

  it('removes a conversation', async () => {
    const repo = makeRepo()
    const id = await repo.create('u1', 't')
    await repo.remove('u1', id)
    expect(await repo.list('u1')).toHaveLength(0)
  })

  it('does not let another user read or delete a conversation', async () => {
    const repo = makeRepo()
    const id = await repo.create('u1', 't')
    expect(await repo.getMessages('u2', id)).toEqual([])
    await expect(repo.remove('u2', id)).rejects.toThrow()
  })
})
