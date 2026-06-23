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
})
