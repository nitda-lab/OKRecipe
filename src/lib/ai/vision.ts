export type ExtractedItem = { name: string; qtyText: string }
export type ExtractionResult = { kind: 'receipt' | 'fridge'; items: ExtractedItem[] }

function coerceItem(row: unknown): ExtractedItem | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  const qty =
    typeof r.qtyText === 'string' ? r.qtyText : typeof r.qty_text === 'string' ? r.qty_text : ''
  if (!name) return null
  return { name, qtyText: (qty as string).trim() }
}

// 途中で切れた配列からも、完結した {...} 要素だけを救出する
function salvageObjects(s: string): ExtractedItem[] {
  const out: ExtractedItem[] = []
  let depth = 0
  let startIdx = -1
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '{') {
      if (depth === 0) startIdx = i
      depth++
    } else if (c === '}') {
      if (depth > 0) depth--
      if (depth === 0 && startIdx >= 0) {
        try {
          const item = coerceItem(JSON.parse(s.slice(startIdx, i + 1)))
          if (item) out.push(item)
        } catch {
          // 不完全な要素はスキップ
        }
        startIdx = -1
      }
    }
  }
  return out
}

export function parseExtraction(text: string): ExtractedItem[] {
  let s = text.trim()
  // ```json ... ``` / ``` ... ``` フェンス除去
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  // 配列部分だけを抜き出す
  const start = s.indexOf('[')
  const end = s.lastIndexOf(']')
  if (start >= 0 && end > start) s = s.slice(start, end + 1)
  try {
    const data = JSON.parse(s)
    if (Array.isArray(data)) {
      return data.map(coerceItem).filter((x): x is ExtractedItem => x !== null)
    }
  } catch {
    // 切り詰め等で壊れている場合は救出にフォールバック
  }
  return salvageObjects(s)
}

export function parseResult(text: string): ExtractionResult {
  const items = parseExtraction(text)
  const m = text.match(/"kind"\s*:\s*"(receipt|fridge)"/i)
  const kind = m && m[1].toLowerCase() === 'receipt' ? 'receipt' : 'fridge'
  return { kind, items }
}

const UNIFIED_PROMPT =
  'これは私が今持っている食材を写した1枚以上の写真です（レシート・冷蔵庫の中・机に並べた材料が混在することがあります）。すべての写真を合わせて、手持ちの食材を1つのリストに統合してください。' +
  'レシートの場合は購入した食品だけを抽出（税・合計・袋・店名など食品以外は除外）。' +
  '冷蔵庫や並べた食材の写真は、棚→ドアポケット→引き出しの順に走査し、隠れていても・小さくても、食材名を特定できるものはすべて挙げる。' +
  'ただし、何の食材か特定できないものは挙げないこと。色・パッケージ・形状だけに基づく推測名や描写名（例:「白っぽい食品」「赤いパッケージの食品」「容器に入った何か」）は禁止。実際に食材名を特定できたものだけを出力する。' +
  '複数の写真に同じ物が写っている場合は1つにまとめ重複させない。ただし明らかに別個体が複数あるならその数を反映。' +
  '個数や量は自然言語で、不明なら"あり"。英語/ローマ字表記は日本語に直す。' +
  '出力は次の形式のJSONのみ: {"kind":"fridge","items":[{"name":"卵","qty_text":"6個"}]}。kindはレシートが主なら"receipt"、それ以外は"fridge"。'

const VISION_MAX_TOKENS = 3000

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
    async extract(images: string[]): Promise<ExtractionResult> {
      const maxTokens = deps.maxTokens ?? VISION_MAX_TOKENS
      const content = [
        { type: 'text', text: UNIFIED_PROMPT },
        ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
      ]
      const res = await doFetch(`${deps.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${deps.apiKey}` },
        body: JSON.stringify({
          model: deps.model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content }],
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(`vision error ${res.status}: ${t}`)
      }
      const data = await res.json()
      return parseResult(data.choices?.[0]?.message?.content ?? '')
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
