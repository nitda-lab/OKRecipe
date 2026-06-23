import { parseExtraction, type ExtractedItem } from './vision'

export type DraftEditDeps = {
  apiKey: string
  baseUrl: string
  model: string
  maxTokens?: number
  fetchFn?: typeof fetch
}

export function createDraftEditor(deps: DraftEditDeps) {
  const doFetch = deps.fetchFn ?? fetch
  const maxTokens = deps.maxTokens ?? 800
  return {
    async edit(items: ExtractedItem[], instruction: string): Promise<ExtractedItem[]> {
      const prompt = `現在の食材リスト(JSON): ${JSON.stringify(items)}
ユーザーの指示: 「${instruction}」
指示に従ってリストを修正し、修正後のリスト全体をJSON配列だけで返してください。説明文は不要。
形式: [{"name":"卵","qty_text":"2個"}]`
      const res = await doFetch(`${deps.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${deps.apiKey}` },
        body: JSON.stringify({
          model: deps.model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: '食材リストをユーザー指示で編集し、JSON配列だけを返すアシスタント。' },
            { role: 'user', content: prompt },
          ],
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(`draft edit error ${res.status}: ${t}`)
      }
      const data = await res.json()
      return parseExtraction(data.choices?.[0]?.message?.content ?? '')
    },
  }
}

export function createDraftEditorFromEnv(fetchFn?: typeof fetch) {
  return createDraftEditor({
    apiKey: process.env.AI_API_KEY!,
    baseUrl: process.env.AI_BASE_URL ?? 'https://nano-gpt.com/v1',
    model: process.env.AI_CHAT_MODEL ?? 'google/gemma-4-31b-it',
    fetchFn,
  })
}
