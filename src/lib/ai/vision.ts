export type ExtractedItem = { name: string; qtyText: string }

export function parseExtraction(text: string): ExtractedItem[] {
  let s = text.trim()
  // ```json ... ``` / ``` ... ``` フェンス除去
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  // 前後に説明文がある場合に備え、配列部分だけを抜き出す
  const start = s.indexOf('[')
  const end = s.lastIndexOf(']')
  if (start >= 0 && end > start) s = s.slice(start, end + 1)
  let data: unknown
  try {
    data = JSON.parse(s)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: ExtractedItem[] = []
  for (const row of data) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    const qty =
      typeof r.qtyText === 'string' ? r.qtyText : typeof r.qty_text === 'string' ? r.qty_text : ''
    if (!name) continue
    out.push({ name, qtyText: (qty as string).trim() })
  }
  return out
}

const PROMPTS: Record<'receipt' | 'fridge', string> = {
  receipt:
    'このレシート画像から購入した食材名と個数を抽出してJSON配列だけを返してください。形式: [{"name":"卵","qty_text":"2個"}]。食品以外（袋・税・合計など）は除外。英語/ローマ字表記は日本語に直す。',
  fridge:
    'この冷蔵庫の写真に見える食材を、できるだけ漏れなく全部列挙してJSON配列だけを返してください。形式: [{"name":"卵","qty_text":"2個"}]。棚→ドアポケット→引き出しの順に走査し、見えるものはすべて挙げる。一部しか見えない・包装で隠れていても、判別できれば挙げる。間引かない（調味料の小瓶なども含める）。個数や量が分かれば自然言語で、不明なら"あり"。食品・飲料・食材のみ（容器・家電・宣伝文は除外）。英語/ローマ字表記は日本語に直す。',
}

const MAX_TOKENS: Record<'receipt' | 'fridge', number> = {
  receipt: 1000,
  fridge: 2500,
}

export type VisionDeps = {
  apiKey: string
  baseUrl: string
  model: string
  maxTokens?: number
  fetchFn?: typeof fetch
}

export function createVisionExtractor(deps: VisionDeps) {
  const doFetch = deps.fetchFn ?? fetch
  return {
    async extract(imageDataUrl: string, kind: 'receipt' | 'fridge'): Promise<ExtractedItem[]> {
      const maxTokens = deps.maxTokens ?? MAX_TOKENS[kind]
      const res = await doFetch(`${deps.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${deps.apiKey}` },
        body: JSON.stringify({
          model: deps.model,
          max_tokens: maxTokens,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: PROMPTS[kind] },
                { type: 'image_url', image_url: { url: imageDataUrl } },
              ],
            },
          ],
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(`vision error ${res.status}: ${t}`)
      }
      const data = await res.json()
      return parseExtraction(data.choices?.[0]?.message?.content ?? '')
    },
  }
}

export function createVisionExtractorFromEnv(fetchFn?: typeof fetch) {
  return createVisionExtractor({
    apiKey: process.env.AI_API_KEY!,
    baseUrl: process.env.AI_BASE_URL ?? 'https://nano-gpt.com/v1',
    model: process.env.AI_VISION_MODEL ?? 'google/gemma-4-31b-it',
    fetchFn,
  })
}
