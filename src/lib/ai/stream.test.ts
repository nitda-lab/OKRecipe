import { describe, it, expect, vi } from 'vitest'
import { newStreamState, applyStreamChunk, finalizeStreamState, readSSE } from './stream'

function chunk(delta: Record<string, unknown>) {
  return { choices: [{ delta }] }
}

describe('applyStreamChunk', () => {
  it('accumulates content deltas and calls onToken', () => {
    const s = newStreamState()
    const tokens: string[] = []
    applyStreamChunk(s, chunk({ content: 'こん' }), (t) => tokens.push(t))
    applyStreamChunk(s, chunk({ content: 'にちは' }), (t) => tokens.push(t))
    expect(s.content).toBe('こんにちは')
    expect(tokens).toEqual(['こん', 'にちは'])
  })

  it('ignores reasoning deltas', () => {
    const s = newStreamState()
    const tokens: string[] = []
    applyStreamChunk(s, chunk({ reasoning: 'thinking...' }), (t) => tokens.push(t))
    expect(s.content).toBe('')
    expect(tokens).toEqual([])
  })

  it('assembles tool_calls from fragments by index', () => {
    const s = newStreamState()
    applyStreamChunk(s, chunk({ tool_calls: [{ index: 0, id: 't1', function: { name: 'add_inventory' } }] }))
    applyStreamChunk(s, chunk({ tool_calls: [{ index: 0, function: { arguments: '{"name":"卵"' } }] }))
    applyStreamChunk(s, chunk({ tool_calls: [{ index: 0, function: { arguments: ',"qty_text":"2個"}' } }] }))
    const msg = finalizeStreamState(s)
    expect(msg.tool_calls).toHaveLength(1)
    expect(msg.tool_calls![0].id).toBe('t1')
    expect(msg.tool_calls![0].function.name).toBe('add_inventory')
    expect(JSON.parse(msg.tool_calls![0].function.arguments)).toEqual({ name: '卵', qty_text: '2個' })
  })
})

describe('finalizeStreamState', () => {
  it('omits tool_calls when none present', () => {
    const s = newStreamState()
    applyStreamChunk(s, chunk({ content: 'hi' }))
    expect(finalizeStreamState(s).tool_calls).toBeUndefined()
  })
})

describe('readSSE', () => {
  it('parses data lines across chunk boundaries and stops at [DONE]', async () => {
    const lines = [
      'data: {"choices":[{"delta":{"content":"あ"}}]}\n\n',
      'data: {"choices":[{"delta":{"con', // 途中で切れる
      'tent":"い"}}]}\n\n',
      'data: [DONE]\n\n',
      'data: {"choices":[{"delta":{"content":"無視"}}]}\n\n', // [DONE]後は読まない
    ]
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder()
        for (const l of lines) controller.enqueue(enc.encode(l))
        controller.close()
      },
    })
    const got: unknown[] = []
    await readSSE(body, (o) => got.push(o))
    const s = newStreamState()
    for (const c of got) applyStreamChunk(s, c)
    expect(s.content).toBe('あい')
  })
})
