# 写真取り込み：自動判別＋複数枚統合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 複数枚の写真を1回のvision呼び出しにまとめ、レシート/冷蔵庫を自動判別しつつ統合・重複排除した食材リストを返す。

**Architecture:** `vision.extract(images[])` が統合プロンプト＋複数image_urlで1回呼び出し、`{kind, items}` を返す。`/api/ingest` は images 配列を受ける。`PhotoIngest` は送信前に画像をダウンスケールし全枚を1回POST、kindトグルを撤去。

**Tech Stack:** TypeScript (strict), Next.js App Router, Vitest（fetchモック注入）, ブラウザ canvas。

## Global Constraints

- 出力JSON形式: `{"kind":"fridge","items":[{"name":"卵","qty_text":"6個"}]}`。`parseExtraction` は items 配列を抽出。
- 実APIは叩かない。テストは `fetchFn` をモック注入する。canvas描画は手動検証（純粋部分のみユニットテスト）。
- DBスキーマ変更なし（`ingest_logs.kind` は `'receipt'|'fridge'`）。
- ダウンスケール既定: 長辺最大 **1568px** / JPEG品質 **0.8**。一度に最大 **8枚**。`max_tokens` は **3000**。
- コミット前に `npm run lint` と `npm run build` を通す。`/api/ingest` の呼び出し元は PhotoIngest のみ。

---

### Task 1: vision.ts — 統合抽出（複数画像・自動判別・切り詰め耐性パース）

**Files:**
- Modify: `src/lib/ai/vision.ts`
- Test: `src/lib/ai/vision.test.ts`

**Interfaces:**
- Produces:
  - `type ExtractionResult = { kind: 'receipt' | 'fridge'; items: ExtractedItem[] }`
  - `parseExtraction(text: string): ExtractedItem[]`（切り詰め救出対応・維持）
  - `parseResult(text: string): ExtractionResult`
  - `createVisionExtractor(deps).extract(images: string[]): Promise<ExtractionResult>`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/ai/vision.test.ts` を次の内容に**全面置き換え**する（既存 `parseExtraction` テストは維持しつつ追加）:

```ts
import { describe, it, expect, vi } from 'vitest'
import { parseExtraction, parseResult, createVisionExtractor } from './vision'

describe('parseExtraction', () => {
  it('parses a plain JSON array', () => {
    expect(parseExtraction('[{"name":"卵","qty_text":"2個"}]')).toEqual([{ name: '卵', qtyText: '2個' }])
  })
  it('strips ```json code fences', () => {
    expect(parseExtraction('```json\n[{"name":"牛乳","qty_text":"1本"}]\n```')).toEqual([
      { name: '牛乳', qtyText: '1本' },
    ])
  })
  it('accepts qtyText or qty_text and skips entries without a name', () => {
    expect(parseExtraction('[{"name":"卵","qtyText":"2個"},{"qty_text":"3個"}]')).toEqual([
      { name: '卵', qtyText: '2個' },
    ])
  })
  it('returns [] for non-array / unparseable input', () => {
    expect(parseExtraction('ごめんなさい、読めません')).toEqual([])
  })
  it('salvages complete objects from a truncated array', () => {
    const truncated = '[{"name":"卵","qty_text":"2個"},{"name":"牛乳","qty_te'
    expect(parseExtraction(truncated)).toEqual([{ name: '卵', qtyText: '2個' }])
  })
})

describe('parseResult', () => {
  it('reads kind and items from the wrapper object', () => {
    const text = '{"kind":"receipt","items":[{"name":"卵","qty_text":"2個"}]}'
    expect(parseResult(text)).toEqual({ kind: 'receipt', items: [{ name: '卵', qtyText: '2個' }] })
  })
  it('defaults kind to fridge for a bare array', () => {
    expect(parseResult('[{"name":"卵","qty_text":"2個"}]')).toEqual({
      kind: 'fridge',
      items: [{ name: '卵', qtyText: '2個' }],
    })
  })
})

describe('createVisionExtractor', () => {
  const ok = (content: string) => () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })

  it('sends all images in one message and returns {kind, items}', async () => {
    const fetchFn = vi.fn(ok('{"kind":"fridge","items":[{"name":"人参","qty_text":"3本"}]}'))
    const ex = createVisionExtractor({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'vm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    const result = await ex.extract(['data:image/png;base64,AAAA', 'data:image/png;base64,BBBB'])
    expect(result).toEqual({ kind: 'fridge', items: [{ name: '人参', qtyText: '3本' }] })

    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)
    expect(body.model).toBe('vm')
    expect(body.max_tokens).toBe(3000)
    const parts = body.messages[0].content
    expect(parts.filter((p: { type: string }) => p.type === 'image_url')).toHaveLength(2)
    expect(parts.filter((p: { type: string }) => p.type === 'text')).toHaveLength(1)
  })

  it('lets deps.maxTokens override the default', async () => {
    const fetchFn = vi.fn(ok('[]'))
    await createVisionExtractor({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'vm', maxTokens: 99,
      fetchFn: fetchFn as unknown as typeof fetch,
    }).extract(['data:image/png;base64,AAAA'])
    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)
    expect(body.max_tokens).toBe(99)
  })

  it('throws on non-200', async () => {
    const fetchFn = vi.fn(async () => new Response('boom', { status: 500 }))
    const ex = createVisionExtractor({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'vm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    await expect(ex.extract(['data:image/png;base64,AAAA'])).rejects.toThrow()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- vision`
Expected: FAIL（`parseResult` 未定義、`extract` のシグネチャ不一致、salvage未実装）。

- [ ] **Step 3: vision.ts を実装する**

`src/lib/ai/vision.ts` を次の内容に**全面置き換え**する:

```ts
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
  '冷蔵庫や並べた食材の写真は、棚→ドアポケット→引き出しの順に走査し、隠れていても判別できれば漏れなく挙げる。' +
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
```

- [ ] **Step 4: テスト通過を確認**

Run: `npm test -- vision`
Expected: 全件 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/ai/vision.ts src/lib/ai/vision.test.ts
git commit -m "feat(vision): unified multi-image extraction with auto-detect + truncation-resilient parse"
```

---

### Task 2: /api/ingest — images 配列を受ける

**Files:**
- Modify: `src/app/api/ingest/route.ts`

**Interfaces:**
- Consumes: `createVisionExtractorFromEnv().extract(images: string[]): Promise<{kind, items}>`（Task 1）。

- [ ] **Step 1: route を書き換える**

`src/app/api/ingest/route.ts` の本文を次に置き換える（import群はそのまま維持）:

```ts
export async function POST(req: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error

  const body = await req.json()
  const images =
    Array.isArray(body?.images) && body.images.every((x: unknown) => typeof x === 'string')
      ? (body.images as string[])
      : null
  if (!images || images.length === 0) {
    return NextResponse.json(
      { error: 'images (non-empty array of data URLs) required' },
      { status: 400 },
    )
  }

  const extractor = createVisionExtractorFromEnv()
  try {
    const { kind, items } = await extractor.extract(images)
    try {
      await new SupabaseIngestLogRepository(auth.sb).record(auth.userId, kind, JSON.stringify(items))
    } catch {
      // ログ失敗は握りつぶす（抽出結果は返す）
    }
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
```

- [ ] **Step 2: build で型を確認**

Run: `npm run build`
Expected: 型チェック成功（`extract` の新シグネチャと整合）。

- [ ] **Step 3: コミット**

```bash
git add src/app/api/ingest/route.ts
git commit -m "feat(api): ingest accepts images array, logs auto-detected kind"
```

---

### Task 3: ダウンスケール util ＋ PhotoIngest UI（kind撤去・1回送信）

**Files:**
- Create: `src/lib/image/downscale.ts`
- Test: `src/lib/image/downscale.test.ts`
- Modify: `src/components/PhotoIngest.tsx`

**Interfaces:**
- Produces: `fitWithin(w, h, max): { width, height }`、`downscaleDataUrl(file: File, max?, quality?): Promise<string>`

- [ ] **Step 1: 失敗するテストを書く（純粋部分のみ）**

`src/lib/image/downscale.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fitWithin } from './downscale'

describe('fitWithin', () => {
  it('keeps dimensions when both sides are within max', () => {
    expect(fitWithin(800, 600, 1568)).toEqual({ width: 800, height: 600 })
  })
  it('scales down preserving aspect ratio when the long side exceeds max', () => {
    expect(fitWithin(4000, 3000, 1568)).toEqual({ width: 1568, height: 1176 })
  })
  it('handles portrait orientation (height is the long side)', () => {
    expect(fitWithin(3000, 4000, 1568)).toEqual({ width: 1176, height: 1568 })
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- downscale`
Expected: FAIL（`fitWithin` 未定義）。

- [ ] **Step 3: downscale.ts を実装する**

`src/lib/image/downscale.ts`:

```ts
// 純粋関数: 長辺が max を超える場合のみ縦横比維持で縮小後の寸法を返す
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h }
  const scale = max / Math.max(w, h)
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}

// ブラウザ専用: 画像を縮小し JPEG data URL を返す（送信ボディを小さくするため）
export async function downscaleDataUrl(file: File, max = 1568, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', quality)
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `npm test -- downscale`
Expected: PASS。

- [ ] **Step 5: PhotoIngest を更新する**

`src/components/PhotoIngest.tsx` を次のように変更する:

(a) import に追加:

```ts
import { downscaleDataUrl } from '@/lib/image/downscale'
```

(b) `type Kind = 'receipt' | 'fridge'` と `fileToDataUrl` 関数を削除し、`const [kind, setKind] = useState<Kind>('receipt')` も削除。

(c) `onAddPhotos` を 8枚上限つきに置き換え:

```ts
  function onAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setDone(false)
    setStaged((prev) => {
      const room = 8 - prev.length
      if (room <= 0) {
        setError('写真は一度に8枚までです')
        return prev
      }
      if (files.length > room) setError('写真は一度に8枚までです')
      return [...prev, ...files.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }))]
    })
    e.target.value = ''
  }
```

(d) `send()` を「全枚をダウンスケールして1回POST」に置き換え:

```ts
  async function send() {
    if (staged.length === 0 || loading) return
    setLoading(true)
    setError(null)
    setDone(false)
    try {
      const images = await Promise.all(staged.map((s) => downscaleDataUrl(s.file)))
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ images }),
      })
      const data = await res.json()
      if (res.ok) {
        setRows((prev) => [...prev, ...(data.items ?? [])])
        staged.forEach((s) => URL.revokeObjectURL(s.url))
        setStaged([])
      } else {
        setError(data.error ?? 'failed')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
```

(e) JSX から「写真の種類」トグルのブロックを削除する（`<span>写真の種類</span>` を含む `<div className="flex flex-col gap-1">…</div>` 全体）。`reFlect方法`(add/overwrite) トグルは残す。

- [ ] **Step 6: lint と build を通す**

Run: `npm run lint`
Expected: エラーなし（未使用の `Kind` / `fileToDataUrl` が残っていないこと）。

Run: `npm run build`
Expected: 成功。

- [ ] **Step 7: 全テスト実行**

Run: `npm test`
Expected: 全件 PASS。

- [ ] **Step 8: コミット**

```bash
git add src/lib/image/downscale.ts src/lib/image/downscale.test.ts src/components/PhotoIngest.tsx
git commit -m "feat(ingest-ui): auto-detect kind, downscale + single batched upload, 8-photo cap"
```

---

## 手動検証（コミット後）

`npm run dev -- -H 0.0.0.0` で起動し、以下を確認:
- レシート1枚 / 冷蔵庫1枚 → 自動判別され妥当に抽出される。
- 冷蔵庫の別アングル複数枚 → 重複が統合される。
- 冷蔵庫＋机に並べた材料 → 両方が1リストに統合される。
- 複数枚でも 413 等のエラーが出ない（ダウンスケールが効いている）。
