export type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: ToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string }

export type ToolSchema = {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export type AssistantMessage = { role: 'assistant'; content: string; tool_calls?: ToolCall[] }

export type StreamCallbacks = { onToken?: (text: string) => void }

export interface AIProvider {
  chat(messages: ChatMessage[], tools: ToolSchema[]): Promise<AssistantMessage>
  chatStream(
    messages: ChatMessage[],
    tools: ToolSchema[],
    cb?: StreamCallbacks,
  ): Promise<AssistantMessage>
}
