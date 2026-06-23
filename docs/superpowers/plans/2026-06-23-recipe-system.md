# 計画4: レシピ保存システム Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** AIが提案したレシピを「保存」し、レシピ画面で一覧・閲覧（Markdown）・削除できる。保存はAIの `save_recipe` ツール → ユーザー確認 → 保存（在庫変更と同じ確認方式）。手動追加も可。

**Architecture:** レシピは独立システム（DB＋リポジトリ抽象、インメモリでテスト＋Supabase実装）。保存の実反映は `/api/recipes` 経由（AIから直接DBに書かない）。チャットの `save_recipe` ツールは「保留アクション」を積むだけで、ユーザーが確認カードで「保存」を押して初めて `/api/recipes` に保存される（spec §6の確認方式を踏襲）。

**Tech Stack:** Next.js 16, TypeScript, Vitest, Supabase。

## Global Constraints
- TypeScript strict、Vitest、テスト隣接。
- レシピの真実は `RecipeRepository`（DB）。AIは直接書かず保留アクション→確認→APIを通す。
- コミット末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

## File Structure
```
supabase/migrations/0004_recipes.sql
src/repositories/recipeRepository.ts            … IF + 型
src/repositories/inMemoryRecipeRepository.ts(.test)
src/repositories/supabaseRecipeRepository.ts
src/app/api/recipes/route.ts                    … GET一覧 / POST作成
src/app/api/recipes/[id]/route.ts               … GET / DELETE
src/lib/ai/inventoryTools.ts                    … save_recipe ツール + PendingAction拡張(修正)
src/lib/ai/chatAgent.ts                         … SYSTEM_PROMPT追記(修正)
src/components/Recipes.tsx                       … 一覧・閲覧・削除
src/app/(app)/recipes/page.tsx
src/components/Chat.tsx                          … confirmでsave_recipe対応(修正)
src/components/NavBar.tsx                        … 「レシピ」追加(修正)
```

---

## Task 1: recipes スキーマ
**Files:** Create `supabase/migrations/0004_recipes.sql`

- [ ] **Step 1: SQL**
```sql
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists recipes_user_idx on recipes (user_id, created_at desc);
alter table recipes enable row level security;
create policy "own recipes select" on recipes for select using (auth.uid() = user_id);
create policy "own recipes insert" on recipes for insert with check (auth.uid() = user_id);
create policy "own recipes delete" on recipes for delete using (auth.uid() = user_id);
```
- [ ] **Step 2: Apply** `node --env-file=.env.local scripts/apply-migration.mjs supabase/migrations/0004_recipes.sql`
- [ ] **Step 3: Commit** `git commit -m "feat: add recipes schema"`

---

## Task 2: RecipeRepository（IF + インメモリ + テスト + Supabase）
**Files:** Create `src/repositories/recipeRepository.ts`, `inMemoryRecipeRepository.ts(.test)`, `supabaseRecipeRepository.ts`

**Interfaces:**
- `type Recipe = { id: string; title: string; body: string; createdAt: string }`
- `type NewRecipe = { title: string; body: string }`
- `interface RecipeRepository { list(userId): Promise<Recipe[]>; create(userId, r: NewRecipe): Promise<Recipe>; get(userId, id): Promise<Recipe | null>; remove(userId, id): Promise<void> }`

- [ ] **Step 1: テスト（インメモリ）**
```ts
import { describe, it, expect } from 'vitest'
import { InMemoryRecipeRepository } from './inMemoryRecipeRepository'

function makeRepo() {
  let n = 0
  return new InMemoryRecipeRepository({ idFactory: () => `r-${++n}`, clock: () => '2026-06-23T00:00:00.000Z' })
}

describe('InMemoryRecipeRepository', () => {
  it('creates and lists recipes for the user', async () => {
    const repo = makeRepo()
    const r = await repo.create('u1', { title: 'オムレツ', body: '卵を焼く' })
    expect(r.id).toBe('r-1')
    const list = await repo.list('u1')
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('オムレツ')
  })
  it('gets a recipe by id', async () => {
    const repo = makeRepo()
    const r = await repo.create('u1', { title: 'A', body: 'b' })
    expect((await repo.get('u1', r.id))?.body).toBe('b')
  })
  it('removes a recipe', async () => {
    const repo = makeRepo()
    const r = await repo.create('u1', { title: 'A', body: 'b' })
    await repo.remove('u1', r.id)
    expect(await repo.list('u1')).toHaveLength(0)
  })
  it('isolates per user', async () => {
    const repo = makeRepo()
    await repo.create('u1', { title: 'A', body: 'b' })
    expect(await repo.list('u2')).toHaveLength(0)
    expect(await repo.get('u2', 'r-1')).toBeNull()
  })
})
```
- [ ] **Step 2: 失敗確認** `npm test -- inMemoryRecipe` → FAIL
- [ ] **Step 3: IF**
```ts
export type Recipe = { id: string; title: string; body: string; createdAt: string }
export type NewRecipe = { title: string; body: string }
export interface RecipeRepository {
  list(userId: string): Promise<Recipe[]>
  create(userId: string, r: NewRecipe): Promise<Recipe>
  get(userId: string, id: string): Promise<Recipe | null>
  remove(userId: string, id: string): Promise<void>
}
```
- [ ] **Step 4: インメモリ実装**
```ts
import type { Recipe, NewRecipe, RecipeRepository } from './recipeRepository'
type Deps = { idFactory: () => string; clock: () => string }
type Row = Recipe & { userId: string }
export class InMemoryRecipeRepository implements RecipeRepository {
  private rows: Row[] = []
  constructor(private deps: Deps) {}
  async list(userId: string): Promise<Recipe[]> {
    return this.rows.filter((r) => r.userId === userId).map(({ userId: _u, ...r }) => r)
  }
  async create(userId: string, r: NewRecipe): Promise<Recipe> {
    const row: Row = { id: this.deps.idFactory(), userId, title: r.title.trim(), body: r.body, createdAt: this.deps.clock() }
    this.rows.push(row)
    const { userId: _u, ...rec } = row
    return rec
  }
  async get(userId: string, id: string): Promise<Recipe | null> {
    const row = this.rows.find((r) => r.id === id && r.userId === userId)
    if (!row) return null
    const { userId: _u, ...rec } = row
    return rec
  }
  async remove(userId: string, id: string): Promise<void> {
    const idx = this.rows.findIndex((r) => r.id === id && r.userId === userId)
    if (idx === -1) throw new Error(`recipe not found: ${id}`)
    this.rows.splice(idx, 1)
  }
}
```
- [ ] **Step 5: pass確認** `npm test -- inMemoryRecipe` → PASS
- [ ] **Step 6: Supabase実装**
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Recipe, NewRecipe, RecipeRepository } from './recipeRepository'
type DbRow = { id: string; title: string; body: string; created_at: string }
const toRecipe = (r: DbRow): Recipe => ({ id: r.id, title: r.title, body: r.body, createdAt: r.created_at })
export class SupabaseRecipeRepository implements RecipeRepository {
  constructor(private sb: SupabaseClient) {}
  async list(userId: string): Promise<Recipe[]> {
    const { data, error } = await this.sb.from('recipes').select('id, title, body, created_at').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) throw error
    return (data as DbRow[]).map(toRecipe)
  }
  async create(userId: string, r: NewRecipe): Promise<Recipe> {
    const { data, error } = await this.sb.from('recipes').insert({ user_id: userId, title: r.title.trim(), body: r.body }).select('id, title, body, created_at').single()
    if (error) throw error
    return toRecipe(data as DbRow)
  }
  async get(userId: string, id: string): Promise<Recipe | null> {
    const { data, error } = await this.sb.from('recipes').select('id, title, body, created_at').eq('user_id', userId).eq('id', id).maybeSingle()
    if (error) throw error
    return data ? toRecipe(data as DbRow) : null
  }
  async remove(userId: string, id: string): Promise<void> {
    const { error } = await this.sb.from('recipes').delete().eq('user_id', userId).eq('id', id)
    if (error) throw error
  }
}
```
- [ ] **Step 7: Commit** `git commit -m "feat: add recipe repository (interface, in-memory, supabase)"`

---

## Task 3: /api/recipes
**Files:** Create `src/app/api/recipes/route.ts`, `src/app/api/recipes/[id]/route.ts`

**Interfaces:**
- `GET /api/recipes` → `Recipe[]`
- `POST /api/recipes` body `{ title, body }` → `Recipe`(201)
- `GET /api/recipes/:id` → `Recipe`(404 if none)
- `DELETE /api/recipes/:id` → 204

- [ ] **Step 1: list/create**
```ts
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { SupabaseRecipeRepository } from '@/repositories/supabaseRecipeRepository'

export async function GET() {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await new SupabaseRecipeRepository(sb).list(auth.user.id))
}
export async function POST(req: Request) {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body?.title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const rec = await new SupabaseRecipeRepository(sb).create(auth.user.id, { title: body.title, body: body.body ?? '' })
  return NextResponse.json(rec, { status: 201 })
}
```
- [ ] **Step 2: get/delete**
```ts
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { SupabaseRecipeRepository } from '@/repositories/supabaseRecipeRepository'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rec = await new SupabaseRecipeRepository(sb).get(auth.user.id, id)
  if (!rec) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(rec)
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  await new SupabaseRecipeRepository(sb).remove(auth.user.id, id)
  return new NextResponse(null, { status: 204 })
}
```
- [ ] **Step 3: Commit** `git commit -m "feat: add /api/recipes routes"`

---

## Task 4: save_recipe ツール + PendingAction拡張
**Files:** Modify `src/lib/ai/inventoryTools.ts`, `src/lib/ai/inventoryTools.test.ts`, `src/lib/ai/chatAgent.ts`

**Interfaces:**
- `PendingAction` に追加: `| { type: 'save_recipe'; title: string; body: string }`
- `INVENTORY_TOOLS` に `save_recipe` 追加（params: title, body）
- `executeTool` で save_recipe を pending に積む

- [ ] **Step 1: テスト追加（inventoryTools.test.ts）**
```ts
  it('save_recipe records a pending recipe save', async () => {
    const repo = makeRepo()
    const pending: PendingAction[] = []
    await executeTool(
      call('save_recipe', { title: 'オムレツ', body: '## 材料\n卵2個' }),
      { repo, userId: 'u1', pending },
    )
    expect(pending).toEqual([{ type: 'save_recipe', title: 'オムレツ', body: '## 材料\n卵2個' }])
  })
```
（既存の `it('exposes the four inventory tools'...)` は名称・本数が変わるため、tool名一覧の検証を `expect(names).toContain('save_recipe')` に緩める）

- [ ] **Step 2: 失敗確認** `npm test -- inventoryTools` → FAIL
- [ ] **Step 3: 実装（inventoryTools.ts）**
  - `PendingAction` ユニオンに `| { type: 'save_recipe'; title: string; body: string }` を追加
  - `INVENTORY_TOOLS` に追加:
```ts
  {
    type: 'function',
    function: {
      name: 'save_recipe',
      description: 'レシピを保存する提案（実際の保存はユーザー確認後）。ユーザーが「このレシピ保存して」等と言ったときに使う。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'レシピ名' },
          body: { type: 'string', description: 'レシピ本文（Markdown。材料と手順）' },
        },
        required: ['title', 'body'],
      },
    },
  },
```
  - `executeTool` の switch に:
```ts
    case 'save_recipe': {
      ctx.pending.push({ type: 'save_recipe', title: args.title, body: args.body })
      return `レシピ「${args.title}」の保存を提案しました（ユーザー確認待ち）`
    }
```
- [ ] **Step 4: pass確認** `npm test -- inventoryTools` → PASS
- [ ] **Step 5: SYSTEM_PROMPT追記（chatAgent.ts）** 末尾に:
```
- ユーザーがレシピの保存を望んだら save_recipe ツールで提案する（body は材料と手順をMarkdownで）。
```
- [ ] **Step 6: Commit** `git commit -m "feat: add save_recipe tool and pending action"`

---

## Task 5: レシピUI + ナビ + チャット確認対応
**Files:** Create `src/components/Recipes.tsx`, `src/app/(app)/recipes/page.tsx`; Modify `src/components/NavBar.tsx`, `src/components/Chat.tsx`

- [ ] **Step 1: ナビに「レシピ」追加（NavBar.tsx）**
```tsx
import Link from 'next/link'
export function NavBar() {
  return (
    <nav className="mb-4 flex gap-4 border-b pb-2 text-sm">
      <Link href="/inventory" className="font-medium">在庫</Link>
      <Link href="/ingest" className="font-medium">取り込み</Link>
      <Link href="/chat" className="font-medium">チャット</Link>
      <Link href="/recipes" className="font-medium">レシピ</Link>
    </nav>
  )
}
```

- [ ] **Step 2: チャットの confirm に save_recipe 対応（Chat.tsx）**
  `confirm` 関数の分岐に追加（先頭付近）:
```tsx
    if (action.type === 'save_recipe') {
      await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: action.title, body: action.body }),
      })
      setPending((p) => p.filter((a) => a !== action))
      return
    }
```
  `label` 関数に追加:
```tsx
    if (a.type === 'save_recipe') return `レシピ保存: ${a.title}`
```

- [ ] **Step 3: レシピ画面（Recipes.tsx）**
```tsx
'use client'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Recipe = { id: string; title: string; body: string; createdAt: string }

export function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [open, setOpen] = useState<Recipe | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  async function load() {
    const res = await fetch('/api/recipes')
    if (res.ok) setRecipes(await res.json())
  }
  useEffect(() => {
    load()
  }, [])

  async function add() {
    if (!title.trim()) return
    await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), body }),
    })
    setTitle('')
    setBody('')
    load()
  }
  async function remove(id: string) {
    await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
    if (open?.id === id) setOpen(null)
    load()
  }

  if (open) {
    return (
      <main className="flex flex-col gap-3">
        <button onClick={() => setOpen(null)} className="self-start text-sm text-blue-600">← 一覧へ</button>
        <h1 className="text-lg font-bold">{open.title}</h1>
        <div className="text-sm [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-bold [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{open.body}</ReactMarkdown>
        </div>
        <button onClick={() => remove(open.id)} className="self-start text-sm text-red-600">このレシピを削除</button>
      </main>
    )
  }

  return (
    <main className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">レシピ</h1>

      <details className="rounded border p-2">
        <summary className="cursor-pointer text-sm">手動で追加</summary>
        <div className="mt-2 flex flex-col gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="レシピ名" className="rounded border p-2" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="本文（Markdown）" rows={5} className="rounded border p-2" />
          <button onClick={add} className="self-start rounded bg-black px-3 py-1 text-sm text-white">追加</button>
        </div>
      </details>

      {recipes.length === 0 ? (
        <p className="py-8 text-center text-gray-500">保存済みレシピはありません。チャットで「このレシピ保存して」と頼めます。</p>
      ) : (
        <ul className="divide-y">
          {recipes.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-3">
              <button onClick={() => setOpen(r)} className="flex-1 text-left font-medium">{r.title}</button>
              <button onClick={() => remove(r.id)} className="px-2 text-red-600" aria-label="削除">×</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 4: レシピページ（recipes/page.tsx）**
```tsx
import { Recipes } from '@/components/Recipes'
export default function RecipesPage() {
  return <Recipes />
}
```

- [ ] **Step 5: ビルド & 手動E2E** `npm run build` → 成功。dev で `/chat`「卵のレシピ教えて」→「これ保存して」→確認カード「保存」→ `/recipes` に出る。閲覧・削除。手動追加も。
- [ ] **Step 6: Commit** `git commit -m "feat: add recipes UI and chat save confirmation"`

---

## Self-Review
- スペック網羅: レシピ保存システム（CRUD・一覧）=Task2/3/5。AI提案レシピの保存=Task4 save_recipe→確認→API。確認方式（spec §6）=保留アクション再利用。
- 型整合: `Recipe/NewRecipe`(Task2)→API(Task3)→UI(Task5)、`PendingAction` save_recipe(Task4)→Chat confirm/label(Task5)。
- 既存再利用: 在庫と同じリポジトリ/確認パターン、remark-gfm のMarkdown表示。
- スコープ外: レシピの編集（今回は追加/削除のみ）、cooked状態連携、献立保存。
