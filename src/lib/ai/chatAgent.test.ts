import { describe, it, expect } from 'vitest'
import { runChatAgent } from './chatAgent'
import type { AIProvider, AssistantMessage, ChatMessage } from './types'
import { InMemoryInventoryRepository } from '@/repositories/inMemoryInventoryRepository'

function makeRepo() {
  let n = 0
  return new InMemoryInventoryRepository({
    idFactory: () => `id-${++n}`,
    clock: () => '2026-06-23T00:00:00.000Z',
  })
}

// 与えられた応答列を順に返すスクリプト型プロバイダ
function scriptedProvider(responses: AssistantMessage[]): AIProvider {
  let i = 0
  return { async chat(): Promise<AssistantMessage> { return responses[i++] } }
}

describe('runChatAgent', () => {
  it('executes a read tool then returns the final text', async () => {
    const repo = makeRepo()
    await repo.add('u1', { name: '卵', quantityText: '2個' })
    const provider = scriptedProvider([
      { role: 'assistant', content: '', tool_calls: [{ id: 't1', type: 'function', function: { name: 'list_inventory', arguments: '{}' } }] },
      { role: 'assistant', content: '卵2個があります。オムレツはどうですか？' },
    ])
    const history: ChatMessage[] = [{ role: 'user', content: '在庫で作れるものは？' }]
    const out = await runChatAgent({ provider, repo, userId: 'u1' }, history)
    expect(out.reply).toContain('オムレツ')
    expect(out.pending).toHaveLength(0)
  })

  it('collects a write tool as a pending action', async () => {
    const repo = makeRepo()
    const provider = scriptedProvider([
      { role: 'assistant', content: '', tool_calls: [{ id: 't1', type: 'function', function: { name: 'add_inventory', arguments: JSON.stringify({ name: '牛乳', qty_text: '1本' }) } }] },
      { role: 'assistant', content: '牛乳1本の追加を提案しました。確認してください。' },
    ])
    const out = await runChatAgent({ provider, repo, userId: 'u1' }, [{ role: 'user', content: '牛乳買った' }])
    expect(out.pending).toEqual([{ type: 'add', name: '牛乳', quantityText: '1本' }])
    expect(out.reply).toContain('提案')
  })

  it('stops at maxSteps to avoid infinite tool loops', async () => {
    const repo = makeRepo()
    const loopMsg: AssistantMessage = { role: 'assistant', content: '', tool_calls: [{ id: 't1', type: 'function', function: { name: 'list_inventory', arguments: '{}' } }] }
    const provider = scriptedProvider([loopMsg, loopMsg, loopMsg, loopMsg, loopMsg, loopMsg])
    const out = await runChatAgent({ provider, repo, userId: 'u1' }, [{ role: 'user', content: 'x' }], { maxSteps: 3 })
    expect(typeof out.reply).toBe('string')
  })
})
