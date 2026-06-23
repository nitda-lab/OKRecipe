import { describe, it, expect, vi } from 'vitest'
import { createDraftEditor } from './draftEdit'

describe('createDraftEditor', () => {
  it('sends the current items and instruction, returns the edited list', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '[{"name":"卵","qty_text":"2個"}]' } }],
        }),
        { status: 200 },
      ),
    )
    const editor = createDraftEditor({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    const out = await editor.edit([{ name: '卵', qtyText: '3個' }], '卵を2個にして')
    expect(out).toEqual([{ name: '卵', qtyText: '2個' }])

    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)
    expect(body.model).toBe('m')
    const userMsg = JSON.stringify(body.messages)
    expect(userMsg).toContain('卵を2個にして')
    expect(userMsg).toContain('3個')
  })

  it('throws on non-200', async () => {
    const fetchFn = vi.fn(async () => new Response('boom', { status: 500 }))
    const editor = createDraftEditor({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    await expect(editor.edit([], 'x')).rejects.toThrow()
  })
})
