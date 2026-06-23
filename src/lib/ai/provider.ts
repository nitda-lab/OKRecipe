import type { AIProvider, AssistantMessage, ChatMessage, StreamCallbacks, ToolSchema } from './types'
import { newStreamState, applyStreamChunk, finalizeStreamState, readSSE } from './stream'

type Deps = {
  apiKey: string
  baseUrl: string
  model: string
  maxTokens?: number
  fetchFn?: typeof fetch
}

export function createNanoGptProvider(deps: Deps): AIProvider {
  const doFetch = deps.fetchFn ?? fetch
  const maxTokens = deps.maxTokens ?? 4000

  function buildBody(messages: ChatMessage[], tools: ToolSchema[], stream: boolean) {
    return JSON.stringify({
      model: deps.model,
      messages,
      max_tokens: maxTokens,
      ...(stream ? { stream: true } : {}),
      ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
    })
  }

  function headers() {
    return { 'content-type': 'application/json', authorization: `Bearer ${deps.apiKey}` }
  }

  return {
    async chat(messages: ChatMessage[], tools: ToolSchema[]): Promise<AssistantMessage> {
      const res = await doFetch(`${deps.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: headers(),
        body: buildBody(messages, tools, false),
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

    async chatStream(
      messages: ChatMessage[],
      tools: ToolSchema[],
      cb?: StreamCallbacks,
    ): Promise<AssistantMessage> {
      const res = await doFetch(`${deps.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: headers(),
        body: buildBody(messages, tools, true),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`AI provider error ${res.status}: ${text}`)
      }
      if (!res.body) throw new Error('AI provider returned no stream body')
      const state = newStreamState()
      await readSSE(res.body, (obj) => applyStreamChunk(state, obj, cb?.onToken))
      return finalizeStreamState(state)
    },
  }
}

export function createNanoGptProviderFromEnv(fetchFn?: typeof fetch): AIProvider {
  return createNanoGptProvider({
    apiKey: process.env.AI_API_KEY!,
    baseUrl: process.env.AI_BASE_URL ?? 'https://nano-gpt.com/v1',
    model: process.env.AI_CHAT_MODEL ?? 'google/gemma-4-31b-it',
    maxTokens: process.env.AI_MAX_TOKENS ? Number(process.env.AI_MAX_TOKENS) : undefined,
    fetchFn,
  })
}
