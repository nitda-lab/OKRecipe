import type { AIProvider, AssistantMessage, ChatMessage, ToolSchema } from './types'

type Deps = { apiKey: string; baseUrl: string; model: string; fetchFn?: typeof fetch }

export function createNanoGptProvider(deps: Deps): AIProvider {
  const doFetch = deps.fetchFn ?? fetch
  return {
    async chat(messages: ChatMessage[], tools: ToolSchema[]): Promise<AssistantMessage> {
      const res = await doFetch(`${deps.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${deps.apiKey}` },
        body: JSON.stringify({
          model: deps.model,
          messages,
          ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`AI provider error ${res.status}: ${text}`)
      }
      const data = await res.json()
      const msg = data.choices?.[0]?.message
      return {
        role: 'assistant',
        content: msg?.content ?? '',
        tool_calls: msg?.tool_calls,
      }
    },
  }
}

export function createNanoGptProviderFromEnv(fetchFn?: typeof fetch): AIProvider {
  return createNanoGptProvider({
    apiKey: process.env.AI_API_KEY!,
    baseUrl: process.env.AI_BASE_URL ?? 'https://nano-gpt.com/v1',
    model: process.env.AI_CHAT_MODEL ?? 'openai/gpt-oss-120b',
    fetchFn,
  })
}
