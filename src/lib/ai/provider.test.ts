import { describe, it, expect, vi } from 'vitest'
import { createNanoGptProvider } from './provider'

function fakeFetch(responseBody: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(responseBody), { status: 200, headers: { 'content-type': 'application/json' } }),
  )
}

describe('createNanoGptProvider', () => {
  it('posts to the chat completions endpoint with auth and model', async () => {
    const fetchFn = fakeFetch({
      choices: [{ message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
    })
    const provider = createNanoGptProvider({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    const msg = await provider.chat([{ role: 'user', content: 'hello' }], [])
    expect(msg.content).toBe('hi')

    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://x/v1/chat/completions')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.model).toBe('m')
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer k' })
  })

  it('sends a generous max_tokens so replies are not truncated', async () => {
    const fetchFn = fakeFetch({
      choices: [{ message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
    })
    const provider = createNanoGptProvider({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'm', maxTokens: 1234,
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    await provider.chat([{ role: 'user', content: 'hello' }], [])
    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)
    expect(body.max_tokens).toBe(1234)
  })

  it('returns tool_calls when present', async () => {
    const fetchFn = fakeFetch({
      choices: [
        {
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [
              { id: 't1', type: 'function', function: { name: 'list_inventory', arguments: '{}' } },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    })
    const provider = createNanoGptProvider({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    const msg = await provider.chat([{ role: 'user', content: '在庫見せて' }], [])
    expect(msg.tool_calls?.[0].function.name).toBe('list_inventory')
  })

  it('throws on non-200', async () => {
    const fetchFn = vi.fn(async () => new Response('boom', { status: 500 }))
    const provider = createNanoGptProvider({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    await expect(provider.chat([{ role: 'user', content: 'x' }], [])).rejects.toThrow()
  })

  it('chatStream streams content tokens and returns the assembled message', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"reasoning":"think"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"オム"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"レツ"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    const fetchFn = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const enc = new TextEncoder()
          for (const l of sse) controller.enqueue(enc.encode(l))
          controller.close()
        },
      })
      return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    })
    const provider = createNanoGptProvider({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    const tokens: string[] = []
    const msg = await provider.chatStream([{ role: 'user', content: 'レシピ' }], [], {
      onToken: (t) => tokens.push(t),
    })
    expect(tokens).toEqual(['オム', 'レツ'])
    expect(msg.content).toBe('オムレツ')
    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)
    expect(body.stream).toBe(true)
  })
})
