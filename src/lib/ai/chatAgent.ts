import type { AIProvider, ChatMessage, StreamCallbacks } from './types'
import type { InventoryRepository } from '@/repositories/inventoryRepository'
import { INVENTORY_TOOLS, executeTool, type PendingAction } from './inventoryTools'

export const SYSTEM_PROMPT = `あなたは「OKRecipe」の料理アシスタントです。
- ユーザーの冷蔵庫の在庫を踏まえて、作れるレシピや献立、買い物を日本語で提案します。
- 在庫を確認するときは必ず list_inventory ツールを使い、推測で在庫を語らないこと。
- 在庫の追加・変更・削除はユーザーの意図が明確なときだけ、対応するツールで「提案」します。提案は確認後に反映されるので、返答では何を提案したか簡潔に伝えてください。
- 回答は簡潔で実用的に。
- 書式はMarkdownのみを使い、HTMLタグ（<br>、<b>等）は絶対に使わないこと。表のセル内で改行したい場合は「、」や「→」で区切り、セルは短くまとめる。手順が長い場合は表ではなく番号付きリストで書く。
- ユーザーがレシピの保存を望んだら save_recipe ツールで提案する（body は材料と手順をMarkdownで書く）。`

type Deps = { provider: AIProvider; repo: InventoryRepository; userId: string }

export async function runChatAgent(
  deps: Deps,
  history: ChatMessage[],
  opts: { maxSteps?: number } = {},
): Promise<{ reply: string; pending: PendingAction[] }> {
  const maxSteps = opts.maxSteps ?? 5
  const pending: PendingAction[] = []
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history]

  let lastText = ''
  for (let step = 0; step < maxSteps; step++) {
    const assistant = await deps.provider.chat(messages, INVENTORY_TOOLS)
    messages.push(assistant)
    if (assistant.content) lastText = assistant.content
    const calls = assistant.tool_calls ?? []
    if (calls.length === 0) break
    for (const call of calls) {
      const result = await executeTool(call, { repo: deps.repo, userId: deps.userId, pending })
      messages.push({ role: 'tool', tool_call_id: call.id, content: result })
    }
  }

  return { reply: lastText || '（応答を生成できませんでした）', pending }
}

type StreamAgentCallbacks = StreamCallbacks & { onStatus?: (status: string) => void }

// ストリーミング版。最終回答の content デルタは cb.onToken に逐次流れる。
// ツール実行の前に cb.onStatus を呼んで状態を伝える。
export async function runChatAgentStream(
  deps: Deps,
  history: ChatMessage[],
  cb: StreamAgentCallbacks = {},
  opts: { maxSteps?: number } = {},
): Promise<{ reply: string; pending: PendingAction[] }> {
  const maxSteps = opts.maxSteps ?? 5
  const pending: PendingAction[] = []
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history]

  let lastText = ''
  for (let step = 0; step < maxSteps; step++) {
    const assistant = await deps.provider.chatStream(messages, INVENTORY_TOOLS, {
      onToken: cb.onToken,
    })
    messages.push(assistant)
    if (assistant.content) lastText = assistant.content
    const calls = assistant.tool_calls ?? []
    if (calls.length === 0) break
    cb.onStatus?.('在庫を確認中…')
    for (const call of calls) {
      const result = await executeTool(call, { repo: deps.repo, userId: deps.userId, pending })
      messages.push({ role: 'tool', tool_call_id: call.id, content: result })
    }
  }

  return { reply: lastText || '（応答を生成できませんでした）', pending }
}
