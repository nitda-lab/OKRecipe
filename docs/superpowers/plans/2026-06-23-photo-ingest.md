# 計画3: 写真取り込み Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** 冷蔵庫/レシートの写真を撮る→AIが食材と個数を抽出→確認リストで編集→確定で在庫へ（レシート=加算 / 冷蔵庫=現状で上書き）。

**Architecture:** 画像認識は計画2のチャットとは別の vision モデル（`google/gemma-4-31b-it`、サブスク内・検証済み）で行う。抽出は `src/lib/ai/vision.ts` に独立モジュール化（JSONパースは純粋関数でテスト）。`/api/ingest` が画像→抽出→生結果を `ingest_logs` に記録し、抽出結果（下書き）を返す。確定時は既存の在庫API（POST/DELETE）をUIから呼ぶ＝在庫の変更経路は一本化。

**Tech Stack:** Next.js 16, TypeScript, Vitest, Supabase, nanoGPT vision (`google/gemma-4-31b-it`).

## Global Constraints

- TypeScript strict、テストは隣接 `*.test.ts`、Vitest。
- 画像認識は `src/lib/ai/vision.ts` のみが行う。モデルは env `AI_VISION_MODEL`（既定 `google/gemma-4-31b-it`）。
- 抽出結果はそのまま在庫に書かない。**下書き確認→確定→在庫API** を必ず通す（spec §5.1）。
- 確定の在庫反映は計画1の在庫APIを再利用（AI/画像から直接DBに書かない）。
- 本マイルストーンでは画像ファイルのStorage保存は行わない（YAGNI）。`ingest_logs` に抽出生JSONと種別のみ記録（image_path はnull許容、将来拡張）。
- コミット末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

---

## File Structure

```
src/lib/ai/vision.ts            … 画像→食材抽出（vision呼び出し + JSONパース）
src/lib/ai/vision.test.ts
supabase/migrations/0003_ingest_logs.sql … ingest_logs テーブル
src/repositories/ingestLogRepository.ts        … 記録IF + Supabase実装（軽量）
src/app/api/ingest/route.ts     … 画像→抽出→ログ記録→下書き返却
src/components/PhotoIngest.tsx   … 撮影/選択 + 下書き確認 + 確定(加算/上書き)
src/app/(app)/ingest/page.tsx   … 取り込み画面
src/components/NavBar.tsx        … 「取り込み」リンク追加（修正）
.env.local(.example)            … AI_VISION_MODEL（追加済み）
```

---

## Task 1: 画像→食材抽出（vision モジュール）

**Files:**
- Create: `src/lib/ai/vision.ts`, `src/lib/ai/vision.test.ts`

**Interfaces:**
- Consumes: なし（独自fetch）
- Produces:
  - `type ExtractedItem = { name: string; qtyText: string }`
  - `function parseExtraction(text: string): ExtractedItem[]`（```json フェンス除去 → JSON配列 → {name, qtyText} に正規化。配列でなければ空配列）
  - `type VisionDeps = { apiKey: string; baseUrl: string; model: string; maxTokens?: number; fetchFn?: typeof fetch }`
  - `function createVisionExtractor(deps: VisionDeps): { extract(imageDataUrl: string, kind: 'receipt' | 'fridge'): Promise<ExtractedItem[]> }`
  - `function createVisionExtractorFromEnv(fetchFn?: typeof fetch): ReturnType<typeof createVisionExtractor>`

- [ ] **Step 1: 失敗するテストを書く**

Create `src/lib/ai/vision.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { parseExtraction, createVisionExtractor } from './vision'

describe('parseExtraction', () => {
  it('parses a plain JSON array', () => {
    expect(parseExtraction('[{"name":"卵","qty_text":"2個"}]')).toEqual([
      { name: '卵', qtyText: '2個' },
    ])
  })

  it('strips ```json code fences', () => {
    const text = '```json\n[{"name":"牛乳","qty_text":"1本"}]\n```'
    expect(parseExtraction(text)).toEqual([{ name: '牛乳', qtyText: '1本' }])
  })

  it('accepts qtyText or qty_text and skips entries without a name', () => {
    const text = '[{"name":"卵","qtyText":"2個"},{"qty_text":"3個"}]'
    expect(parseExtraction(text)).toEqual([{ name: '卵', qtyText: '2個' }])
  })

  it('returns [] for non-array / unparseable input', () => {
    expect(parseExtraction('ごめんなさい、読めません')).toEqual([])
  })
})

describe('createVisionExtractor', () => {
  it('posts the image and returns parsed items', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: '[{"name":"人参","qty_text":"3本"}]' } }] }),
        { status: 200 },
      ),
    )
    const ex = createVisionExtractor({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'vm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    const items = await ex.extract('data:image/png;base64,AAAA', 'receipt')
    expect(items).toEqual([{ name: '人参', qtyText: '3本' }])

    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)
    expect(body.model).toBe('vm')
    const parts = body.messages[0].content
    expect(parts.some((p: { type: string }) => p.type === 'image_url')).toBe(true)
  })

  it('throws on non-200', async () => {
    const fetchFn = vi.fn(async () => new Response('boom', { status: 500 }))
    const ex = createVisionExtractor({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'vm', fetchFn: fetchFn as unknown as typeof fetch,
    })
    await expect(ex.extract('data:image/png;base64,AAAA', 'fridge')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- ai/vision`
Expected: FAIL（未定義）。

- [ ] **Step 3: 実装を書く**

Create `src/lib/ai/vision.ts`:
```ts
export type ExtractedItem = { name: string; qtyText: string }

export function parseExtraction(text: string): ExtractedItem[] {
  let s = text.trim()
  // ```json ... ``` / ``` ... ``` フェンス除去
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  // 先頭の配列部分だけを抜き出す（前後に説明文がある場合に備える）
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
    const qty = typeof r.qtyText === 'string' ? r.qtyText : typeof r.qty_text === 'string' ? r.qty_text : ''
    if (!name) continue
    out.push({ name, qtyText: (qty as string).trim() })
  }
  return out
}

const PROMPTS: Record<'receipt' | 'fridge', string> = {
  receipt:
    'このレシート画像から購入した食材名と個数を抽出してJSON配列だけを返してください。形式: [{"name":"卵","qty_text":"2個"}]。食品以外（袋・税・合計など）は除外。英語/ローマ字表記は日本語に直す。',
  fridge:
    'この冷蔵庫の写真に見える食材を列挙してJSON配列だけを返してください。形式: [{"name":"卵","qty_text":"2個"}]。個数や量が分かれば自然言語で（不明なら"あり"）。調味料の小瓶など細かすぎるものは主要なものに絞る。',
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
  const maxTokens = deps.maxTokens ?? 800
  return {
    async extract(imageDataUrl: string, kind: 'receipt' | 'fridge'): Promise<ExtractedItem[]> {
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- ai/vision`
Expected: PASS（6 passed）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/vision.ts src/lib/ai/vision.test.ts
git commit -m "feat: add image-to-inventory vision extraction"
```

---

## Task 2: ingest_logs スキーマ + 記録リポジトリ

**Files:**
- Create: `supabase/migrations/0003_ingest_logs.sql`, `src/repositories/ingestLogRepository.ts`

**Interfaces:**
- Consumes: `SupabaseClient`
- Produces:
  - `class SupabaseIngestLogRepository { record(userId: string, kind: 'receipt'|'fridge', rawJson: string): Promise<void> }`

- [ ] **Step 1: マイグレーションSQLを書く**

Create `supabase/migrations/0003_ingest_logs.sql`:
```sql
create table if not exists ingest_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('receipt', 'fridge')),
  image_path text,
  ai_raw_json text,
  status text not null default 'extracted',
  created_at timestamptz not null default now()
);

create index if not exists ingest_logs_user_idx on ingest_logs (user_id, created_at desc);

alter table ingest_logs enable row level security;

create policy "own ingest_logs select" on ingest_logs
  for select using (auth.uid() = user_id);
create policy "own ingest_logs insert" on ingest_logs
  for insert with check (auth.uid() = user_id);
```

- [ ] **Step 2: マイグレーションを適用**

Run: `node --env-file=.env.local scripts/apply-migration.mjs supabase/migrations/0003_ingest_logs.sql`
Expected: `migration applied`。

- [ ] **Step 3: 記録リポジトリを書く**

Create `src/repositories/ingestLogRepository.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export class SupabaseIngestLogRepository {
  constructor(private sb: SupabaseClient) {}

  async record(userId: string, kind: 'receipt' | 'fridge', rawJson: string): Promise<void> {
    const { error } = await this.sb
      .from('ingest_logs')
      .insert({ user_id: userId, kind, ai_raw_json: rawJson, status: 'extracted' })
    if (error) throw error
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_ingest_logs.sql src/repositories/ingestLogRepository.ts
git commit -m "feat: add ingest_logs schema and repository"
```

---

## Task 3: /api/ingest ルート

**Files:**
- Create: `src/app/api/ingest/route.ts`

**Interfaces:**
- Consumes: `getServerSupabase`, `createVisionExtractorFromEnv`（Task 1）, `SupabaseIngestLogRepository`（Task 2）
- Produces:
  - `POST /api/ingest` body `{ image: string(dataURL); kind: 'receipt'|'fridge' }` → `{ items: ExtractedItem[] }`（在庫には書かない）

- [ ] **Step 1: ルートを書く**

Create `src/app/api/ingest/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { createVisionExtractorFromEnv } from '@/lib/ai/vision'
import { SupabaseIngestLogRepository } from '@/repositories/ingestLogRepository'

export async function POST(req: Request) {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const image = typeof body?.image === 'string' ? body.image : null
  const kind = body?.kind === 'receipt' || body?.kind === 'fridge' ? body.kind : null
  if (!image || !kind) {
    return NextResponse.json({ error: 'image(dataURL) and kind(receipt|fridge) required' }, { status: 400 })
  }

  const extractor = createVisionExtractorFromEnv()
  try {
    const items = await extractor.extract(image, kind)
    try {
      await new SupabaseIngestLogRepository(sb).record(auth.user.id, kind, JSON.stringify(items))
    } catch {
      // ログ失敗は握りつぶす（抽出結果は返す）
    }
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
```

- [ ] **Step 2: 認証ゲートを手動確認**

Run: `npm run dev`、別シェルで:
```bash
curl -s -w "\n%{http_code}\n" -X POST http://localhost:3000/api/ingest -H "content-type: application/json" -d '{"image":"data:image/png;base64,AAAA","kind":"receipt"}'
```
Expected: `{"error":"unauthorized"}` と `401`。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ingest/route.ts
git commit -m "feat: add /api/ingest route (image -> draft items)"
```

---

## Task 4: 取り込みUI（撮影 → 下書き確認 → 確定）

**Files:**
- Create: `src/components/PhotoIngest.tsx`, `src/app/(app)/ingest/page.tsx`
- Modify: `src/components/NavBar.tsx`

**Interfaces:**
- Consumes: `POST /api/ingest`（Task 3）, `POST /api/inventory`・`GET /api/inventory`・`DELETE /api/inventory/:id`（計画1）
- Produces: 取り込み画面（種別選択・写真選択・抽出・下書き編集・確定）

- [ ] **Step 1: ナビに「取り込み」を追加**

Modify `src/components/NavBar.tsx`:
```tsx
import Link from 'next/link'

export function NavBar() {
  return (
    <nav className="mb-4 flex gap-4 border-b pb-2 text-sm">
      <Link href="/inventory" className="font-medium">在庫</Link>
      <Link href="/ingest" className="font-medium">取り込み</Link>
      <Link href="/chat" className="font-medium">チャット</Link>
    </nav>
  )
}
```

- [ ] **Step 2: 取り込みコンポーネントを書く**

Create `src/components/PhotoIngest.tsx`:
```tsx
'use client'
import { useState } from 'react'

type Kind = 'receipt' | 'fridge'
type Row = { name: string; qtyText: string }

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function PhotoIngest() {
  const [kind, setKind] = useState<Kind>('receipt')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError(null)
    setDone(false)
    try {
      const image = await fileToDataUrl(file)
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, kind }),
      })
      const data = await res.json()
      if (res.ok) setRows(data.items ?? [])
      else setError(data.error ?? 'failed')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, j) => j !== i))
  }
  function addRow() {
    setRows((rs) => [...rs, { name: '', qtyText: '' }])
  }

  async function apply() {
    setLoading(true)
    setError(null)
    try {
      if (kind === 'fridge') {
        // 現状で上書き: 既存在庫を全削除してから追加
        const cur = await fetch('/api/inventory').then((r) => r.json())
        for (const it of cur) await fetch(`/api/inventory/${it.id}`, { method: 'DELETE' })
      }
      for (const r of rows) {
        if (!r.name.trim()) continue
        await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: r.name.trim(), quantityText: r.qtyText.trim() || 'あり' }),
        })
      }
      setRows([])
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">写真で取り込み</h1>

      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setKind('receipt')}
          className={`rounded-full border px-3 py-1 ${kind === 'receipt' ? 'bg-black text-white' : ''}`}
        >
          レシート（加算）
        </button>
        <button
          onClick={() => setKind('fridge')}
          className={`rounded-full border px-3 py-1 ${kind === 'fridge' ? 'bg-black text-white' : ''}`}
        >
          冷蔵庫（上書き）
        </button>
      </div>

      <label className="rounded border border-dashed p-4 text-center text-sm text-gray-600">
        {loading ? '処理中…' : 'タップして写真を撮る / 選ぶ'}
        <input type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
      </label>

      {error && <p className="text-sm text-red-600">エラー: {error}</p>}
      {done && <p className="text-sm text-green-700">在庫に反映しました。</p>}

      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            確認・編集（{kind === 'fridge' ? '確定で現在の在庫を置き換え' : '確定で在庫に加算'}）
          </p>
          <ul className="flex flex-col gap-1">
            {rows.map((r, i) => (
              <li key={i} className="flex gap-2">
                <input
                  value={r.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="食材名"
                  className="flex-1 rounded border p-1"
                />
                <input
                  value={r.qtyText}
                  onChange={(e) => update(i, { qtyText: e.target.value })}
                  placeholder="個数"
                  className="w-24 rounded border p-1"
                />
                <button onClick={() => removeRow(i)} className="px-2 text-red-600" aria-label="行を削除">
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button onClick={addRow} className="rounded border px-3 py-1 text-sm">
              行を追加
            </button>
            <button
              onClick={apply}
              disabled={loading}
              className="rounded bg-black px-3 py-1 text-sm text-white"
            >
              確定して在庫へ
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: 取り込み画面を書く**

Create `src/app/(app)/ingest/page.tsx`:
```tsx
import { PhotoIngest } from '@/components/PhotoIngest'

export default function IngestPage() {
  return <PhotoIngest />
}
```

- [ ] **Step 4: ビルドと手動E2E**

Run: `npm run build`
Expected: ビルド成功。

その後 `npm run dev` → ログイン → `/ingest`：
- 「レシート（加算）」でレシート写真を選ぶ → 下書きに食材が並ぶ → 編集して「確定して在庫へ」→ `/inventory` に加算される。
- 「冷蔵庫（上書き）」で冷蔵庫写真 → 下書き → 確定で在庫が置き換わる。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add photo ingestion UI (capture -> draft -> apply)"
```

---

## Self-Review チェック結果

- **スペック網羅（§5.1）**: 撮影=Task4 file input(capture)。AI抽出=Task1 vision。下書き確認リスト（編集/追加/削除）=Task4。レシート=加算/冷蔵庫=上書き=Task4 apply。確定まで在庫に入らない=抽出は返すだけ/反映はapplyのみ。生結果の記録（やり直し用）=Task2 ingest_logs。
- **プレースホルダ**: なし。
- **型整合性**: `ExtractedItem{name,qtyText}`（Task1）→ API `{items}`（Task3）→ UI Row（Task4）。在庫反映は計画1の在庫API（POST/DELETE）を再利用。
- **モデル**: `google/gemma-4-31b-it`（実画像で抽出精度を検証済み・サブスク内cost0）。
- **スコープ外（将来）**: 画像ファイルのStorage保存、抽出のストリーミング、`ingest_logs` 一覧UI。
```
