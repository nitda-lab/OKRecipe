import { describe, it, expect, vi } from 'vitest'
import { parseExtraction, parseResult, createVisionExtractor } from './vision'

describe('parseExtraction', () => {
  it('parses a plain JSON array', () => {
    expect(parseExtraction('[{"name":"卵","qty_text":"2個"}]')).toEqual([{ name: '卵', qtyText: '2個' }])
  })
  it('strips ```json code fences', () => {
    expect(parseExtraction('```json\n[{"name":"牛乳","qty_text":"1本"}]\n```')).toEqual([
      { name: '牛乳', qtyText: '1本' },
    ])
  })
  it('accepts qtyText or qty_text and skips entries without a name', () => {
    expect(parseExtraction('[{"name":"卵","qtyText":"2個"},{"qty_text":"3個"}]')).toEqual([
      { name: '卵', qtyText: '2個' },
    ])
  })
  it('returns [] for non-array / unparseable input', () => {
    expect(parseExtraction('ごめんなさい、読めません')).toEqual([])
  })
  it('salvages complete objects from a truncated array', () => {
    const truncated = '[{"name":"卵","qty_text":"2個"},{"name":"牛乳","qty_te'
    expect(parseExtraction(truncated)).toEqual([{ name: '卵', qtyText: '2個' }])
  })
})

describe('parseResult', () => {
  it('reads kind and items from the wrapper object', () => {
    const text = '{"kind":"receipt","items":[{"name":"卵","qty_text":"2個"}]}'
    expect(parseResult(text)).toEqual({ kind: 'receipt', items: [{ name: '卵', qtyText: '2個' }] })
  })
  it('defaults kind to fridge for a bare array', () => {
    expect(parseResult('[{"name":"卵","qty_text":"2個"}]')).toEqual({
      kind: 'fridge',
      items: [{ name: '卵', qtyText: '2個' }],
    })
  })
})

describe('createVisionExtractor', () => {
  const ok = (content: string) => () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })

  it('sends all images in one message and returns {kind, items}', async () => {
    const fetchFn = vi.fn(ok('{"kind":"fridge","items":[{"name":"人参","qty_text":"3本"}]}'))
    const ex = createVisionExtractor({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'vm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    const result = await ex.extract(['data:image/png;base64,AAAA', 'data:image/png;base64,BBBB'])
    expect(result).toEqual({ kind: 'fridge', items: [{ name: '人参', qtyText: '3本' }] })

    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)
    expect(body.model).toBe('vm')
    expect(body.max_tokens).toBe(3000)
    const parts = body.messages[0].content
    expect(parts.filter((p: { type: string }) => p.type === 'image_url')).toHaveLength(2)
    expect(parts.filter((p: { type: string }) => p.type === 'text')).toHaveLength(1)
  })

  it('lets deps.maxTokens override the default', async () => {
    const fetchFn = vi.fn(ok('[]'))
    await createVisionExtractor({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'vm', maxTokens: 99,
      fetchFn: fetchFn as unknown as typeof fetch,
    }).extract(['data:image/png;base64,AAAA'])
    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)
    expect(body.max_tokens).toBe(99)
  })

  it('throws on non-200', async () => {
    const fetchFn = vi.fn(async () => new Response('boom', { status: 500 }))
    const ex = createVisionExtractor({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'vm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    await expect(ex.extract(['data:image/png;base64,AAAA'])).rejects.toThrow()
  })
})
