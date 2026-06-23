import { describe, it, expect, vi } from 'vitest'
import { parseExtraction, createVisionExtractor } from './vision'

describe('parseExtraction', () => {
  it('parses a plain JSON array', () => {
    expect(parseExtraction('[{"name":"卵","qty_text":"2個"}]')).toEqual([
      { name: '卵', qtyText: '2個' },
    ])
  })

  it('strips ```json code fences', () => {
    const text = '```json\n[{"name":"牛乳","qty_text":"1本"}]\n```'
    expect(parseExtraction(text)).toEqual([{ name: '牛乳', qtyText: '1本' }])
  })

  it('accepts qtyText or qty_text and skips entries without a name', () => {
    const text = '[{"name":"卵","qtyText":"2個"},{"qty_text":"3個"}]'
    expect(parseExtraction(text)).toEqual([{ name: '卵', qtyText: '2個' }])
  })

  it('returns [] for non-array / unparseable input', () => {
    expect(parseExtraction('ごめんなさい、読めません')).toEqual([])
  })
})

describe('createVisionExtractor', () => {
  it('posts the image and returns parsed items', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: '[{"name":"人参","qty_text":"3本"}]' } }] }),
        { status: 200 },
      ),
    )
    const ex = createVisionExtractor({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'vm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    const items = await ex.extract('data:image/png;base64,AAAA', 'receipt')
    expect(items).toEqual([{ name: '人参', qtyText: '3本' }])

    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)
    expect(body.model).toBe('vm')
    const parts = body.messages[0].content
    expect(parts.some((p: { type: string }) => p.type === 'image_url')).toBe(true)
  })

  it('throws on non-200', async () => {
    const fetchFn = vi.fn(async () => new Response('boom', { status: 500 }))
    const ex = createVisionExtractor({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'vm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    await expect(ex.extract('data:image/png;base64,AAAA', 'fridge')).rejects.toThrow()
  })
})
