import type { AssistantMessage, ToolCall } from './types'

// OpenAI互換ストリームの逐次累積状態。
export type StreamState = { content: string; toolCalls: ToolCall[] }

export function newStreamState(): StreamState {
  return { content: '', toolCalls: [] }
}

// 1つのストリームチャンク(JSON)を状態に畳み込む。content デルタは onToken に流す。
// reasoning デルタ（gpt-oss等の思考）は本文ではないので無視する。
export function applyStreamChunk(
  state: StreamState,
  chunk: unknown,
  onToken?: (text: string) => void,
): void {
  const choice = (chunk as { choices?: Array<{ delta?: Record<string, unknown> }> })?.choices?.[0]
  const delta = choice?.delta
  if (!delta) return

  if (typeof delta.content === 'string' && delta.content.length > 0) {
    state.content += delta.content
    onToken?.(delta.content)
  }

  const toolDeltas = delta.tool_calls as
    | Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>
    | undefined
  if (Array.isArray(toolDeltas)) {
    for (const td of toolDeltas) {
      const idx = td.index ?? 0
      if (!state.toolCalls[idx]) {
        state.toolCalls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } }
      }
      const cur = state.toolCalls[idx]
      if (td.id) cur.id = td.id
      if (td.function?.name) cur.function.name += td.function.name
      if (td.function?.arguments) cur.function.arguments += td.function.arguments
    }
  }
}

export function finalizeStreamState(state: StreamState): AssistantMessage {
  const toolCalls = state.toolCalls.filter((t) => t && t.function.name)
  return {
    role: 'assistant',
    content: state.content,
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  }
}

// SSEバイトストリームを行単位で読み、`data:` 行のJSONを onChunk に渡す。
// チャンク境界をまたぐ行はバッファで連結する。
export async function readSSE(
  body: ReadableStream<Uint8Array>,
  onChunk: (obj: unknown) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return
      try {
        onChunk(JSON.parse(data))
      } catch {
        // 不完全/非JSON行は無視
      }
    }
  }
}
