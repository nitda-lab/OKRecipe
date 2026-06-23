# 計画1: 基盤 + 在庫システム Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ログインした2人のユーザーが、在庫を手動で追加・編集・削除でき、自然言語の個数（「2個」「一人前分」）を扱える、動く在庫管理Webアプリの土台を作る。

**Architecture:** Next.js (App Router) + TypeScript。在庫の「真実」はリポジトリ抽象（`InventoryRepository`）の背後に置き、テストはインメモリ実装、本番はSupabase実装で動かす。ドメインロジック（個数パース・在庫操作）はDB非依存の純粋関数としてユニットテストする。UIはモバイルファースト。

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Vitest（ユニットテスト）, Supabase (Postgres / Auth)。

## Global Constraints

- 言語/型: TypeScript（`strict: true`）。
- パッケージマネージャ: npm。
- テスト: Vitest。テストファイルは対象の隣（co-locate）に `*.test.ts` で置く。
- 個数は自然言語を第一級に扱う。厳密な数値計算を前提にしない（`quantity_text` が真、`quantity_num`/`unit_text` は補助）。
- データの「真実」は `InventoryRepository` 経由でのみ読み書きする。ドメイン/サービス層はSupabaseに直接依存しない。
- コミットは各タスク末尾で行う。コミットメッセージ末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` を付ける。
- 在庫の `source` は `receipt | fridge_photo | manual | chat` のいずれか。本計画では手動由来は `manual`。

---

## File Structure（このマイルストーンで作る/触るファイル）

```
package.json, tsconfig.json, next.config.ts, vitest.config.ts   … プロジェクト設定
tailwind config / app/globals.css                              … スタイル基盤
src/domain/quantity.ts            … 自然言語の個数パース（純粋関数）
src/domain/quantity.test.ts
src/domain/inventory.ts           … 在庫アイテム型 + 在庫操作ロジック（純粋関数）
src/domain/inventory.test.ts
src/repositories/inventoryRepository.ts        … InventoryRepository インターフェース + 型
src/repositories/inMemoryInventoryRepository.ts … テスト/ローカル用実装
src/repositories/inMemoryInventoryRepository.test.ts
src/repositories/supabaseInventoryRepository.ts … 本番用実装（鍵が必要）
src/lib/supabaseClient.ts          … Supabaseクライアント生成（鍵が必要）
supabase/migrations/0001_init.sql  … スキーマ（ingredients, inventory_items 等）
src/app/api/inventory/route.ts     … 在庫API（GET一覧 / POST追加）
src/app/api/inventory/[id]/route.ts … 在庫API（PATCH更新 / DELETE削除）
src/app/(app)/inventory/page.tsx   … 在庫一覧画面（モバイルファースト）
src/components/InventoryList.tsx    … 在庫リスト表示
src/components/InventoryItemForm.tsx … 追加/編集フォーム
src/app/layout.tsx, src/app/page.tsx … ルート
.env.local.example                 … 必要な環境変数の見本
```

---

## Task 1: プロジェクト雛形のスキャフォールド

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.env.local.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: なし
- Produces: 動くNext.jsアプリ（`npm run dev` で起動）、`npm test` でVitestが走る土台。

- [ ] **Step 1: Next.jsプロジェクトを生成**

既存ディレクトリ（gitとdocsがある）に対して生成する。Run:
```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm --yes
```
生成中に既存ファイルの上書き確認が出たら既存（.git, docs, .gitignore）を保持する。完了後 `src/app/page.tsx` 等が出来ることを確認。

- [ ] **Step 2: Vitestを導入**

Run:
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: vitest.config.ts を作成**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 4: package.json に test スクリプトを追加**

`scripts` に追記:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: スモークテストで土台を確認**

Create `src/domain/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs the test runner', () => {
    expect(1 + 1).toBe(2)
  })
})
```
Run: `npm test`
Expected: PASS（1 passed）。

- [ ] **Step 6: 環境変数の見本を作成**

Create `.env.local.example`:
```
# Supabase（Task 6以降で使用）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI（計画2以降で使用）
AI_BASE_URL=https://nano-gpt.com/v1
AI_API_KEY=
```
`.gitignore` に `.env*` が含まれていることを確認（含まれていなければ追記）。`.env.local.example` はコミット対象なので除外されないよう `!.env.local.example` を `.gitignore` 末尾に追記。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Vitest project"
```

---

## Task 2: 自然言語の個数パース（quantity ドメイン）

**Files:**
- Create: `src/domain/quantity.ts`, `src/domain/quantity.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `type ParsedQuantity = { text: string; num: number | null; unit: string | null }`
  - `function parseQuantity(text: string): ParsedQuantity`

- [ ] **Step 1: 失敗するテストを書く**

Create `src/domain/quantity.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseQuantity } from './quantity'

describe('parseQuantity', () => {
  it('keeps the original text always', () => {
    expect(parseQuantity('一人前分').text).toBe('一人前分')
  })

  it('extracts a leading number and unit', () => {
    expect(parseQuantity('2個')).toEqual({ text: '2個', num: 2, unit: '個' })
  })

  it('handles full-width digits', () => {
    expect(parseQuantity('３本')).toEqual({ text: '３本', num: 3, unit: '本' })
  })

  it('returns null num/unit when no number present', () => {
    expect(parseQuantity('残り半分')).toEqual({ text: '残り半分', num: null, unit: '残り半分' })
  })

  it('trims surrounding whitespace in text', () => {
    expect(parseQuantity('  3パック ').text).toBe('3パック')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- quantity`
Expected: FAIL（`parseQuantity` が未定義）。

- [ ] **Step 3: 最小実装を書く**

Create `src/domain/quantity.ts`:
```ts
export type ParsedQuantity = { text: string; num: number | null; unit: string | null }

function toHalfWidthDigits(s: string): string {
  return s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
}

export function parseQuantity(input: string): ParsedQuantity {
  const text = input.trim()
  const normalized = toHalfWidthDigits(text)
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  if (match) {
    const num = Number(match[1])
    const unit = match[2].trim() || null
    return { text, num, unit }
  }
  return { text, num: null, unit: text || null }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- quantity`
Expected: PASS（5 passed）。

- [ ] **Step 5: Commit**

```bash
git add src/domain/quantity.ts src/domain/quantity.test.ts
git commit -m "feat: add natural-language quantity parser"
```

---

## Task 3: 在庫ドメイン型と操作ロジック

**Files:**
- Create: `src/domain/inventory.ts`, `src/domain/inventory.test.ts`

**Interfaces:**
- Consumes: `parseQuantity`, `ParsedQuantity`（Task 2）
- Produces:
  - `type InventorySource = 'receipt' | 'fridge_photo' | 'manual' | 'chat'`
  - `type InventoryItem = { id: string; userId: string; name: string; quantityText: string; quantityNum: number | null; unitText: string | null; expiresAt: string | null; source: InventorySource; updatedAt: string }`
  - `type NewInventoryInput = { name: string; quantityText: string; source?: InventorySource; expiresAt?: string | null }`
  - `function buildInventoryItem(input: NewInventoryInput, ctx: { id: string; userId: string; now: string }): InventoryItem`
  - `function applyQuantityChange(item: InventoryItem, newQuantityText: string, now: string): InventoryItem`

- [ ] **Step 1: 失敗するテストを書く**

Create `src/domain/inventory.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildInventoryItem, applyQuantityChange } from './inventory'

const ctx = { id: 'item-1', userId: 'user-1', now: '2026-06-23T00:00:00.000Z' }

describe('buildInventoryItem', () => {
  it('fills derived quantity fields from text', () => {
    const item = buildInventoryItem({ name: '卵', quantityText: '2個' }, ctx)
    expect(item).toEqual({
      id: 'item-1',
      userId: 'user-1',
      name: '卵',
      quantityText: '2個',
      quantityNum: 2,
      unitText: '個',
      expiresAt: null,
      source: 'manual',
      updatedAt: '2026-06-23T00:00:00.000Z',
    })
  })

  it('defaults source to manual and expiresAt to null', () => {
    const item = buildInventoryItem({ name: 'にんじん', quantityText: '一人前分' }, ctx)
    expect(item.source).toBe('manual')
    expect(item.expiresAt).toBeNull()
    expect(item.quantityNum).toBeNull()
  })

  it('respects an explicit source and expiry', () => {
    const item = buildInventoryItem(
      { name: '牛乳', quantityText: '1本', source: 'receipt', expiresAt: '2026-06-30' },
      ctx,
    )
    expect(item.source).toBe('receipt')
    expect(item.expiresAt).toBe('2026-06-30')
  })
})

describe('applyQuantityChange', () => {
  it('updates text, derived fields and updatedAt', () => {
    const item = buildInventoryItem({ name: '卵', quantityText: '2個' }, ctx)
    const updated = applyQuantityChange(item, '1個', '2026-06-24T00:00:00.000Z')
    expect(updated.quantityText).toBe('1個')
    expect(updated.quantityNum).toBe(1)
    expect(updated.updatedAt).toBe('2026-06-24T00:00:00.000Z')
    expect(updated.id).toBe(item.id)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- inventory`
Expected: FAIL（関数未定義）。

- [ ] **Step 3: 最小実装を書く**

Create `src/domain/inventory.ts`:
```ts
import { parseQuantity } from './quantity'

export type InventorySource = 'receipt' | 'fridge_photo' | 'manual' | 'chat'

export type InventoryItem = {
  id: string
  userId: string
  name: string
  quantityText: string
  quantityNum: number | null
  unitText: string | null
  expiresAt: string | null
  source: InventorySource
  updatedAt: string
}

export type NewInventoryInput = {
  name: string
  quantityText: string
  source?: InventorySource
  expiresAt?: string | null
}

export function buildInventoryItem(
  input: NewInventoryInput,
  ctx: { id: string; userId: string; now: string },
): InventoryItem {
  const q = parseQuantity(input.quantityText)
  return {
    id: ctx.id,
    userId: ctx.userId,
    name: input.name.trim(),
    quantityText: q.text,
    quantityNum: q.num,
    unitText: q.unit,
    expiresAt: input.expiresAt ?? null,
    source: input.source ?? 'manual',
    updatedAt: ctx.now,
  }
}

export function applyQuantityChange(
  item: InventoryItem,
  newQuantityText: string,
  now: string,
): InventoryItem {
  const q = parseQuantity(newQuantityText)
  return { ...item, quantityText: q.text, quantityNum: q.num, unitText: q.unit, updatedAt: now }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- inventory`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/domain/inventory.ts src/domain/inventory.test.ts
git commit -m "feat: add inventory domain types and operations"
```

---

## Task 4: 在庫リポジトリ（インターフェース + インメモリ実装）

**Files:**
- Create: `src/repositories/inventoryRepository.ts`, `src/repositories/inMemoryInventoryRepository.ts`, `src/repositories/inMemoryInventoryRepository.test.ts`

**Interfaces:**
- Consumes: `InventoryItem`, `NewInventoryInput`, `buildInventoryItem`, `applyQuantityChange`（Task 3）
- Produces:
  - `interface InventoryRepository { list(userId): Promise<InventoryItem[]>; add(userId, input): Promise<InventoryItem>; updateQuantity(userId, id, quantityText): Promise<InventoryItem>; remove(userId, id): Promise<void> }`
  - `class InMemoryInventoryRepository implements InventoryRepository`（コンストラクタで `idFactory`, `clock` を注入可）

- [ ] **Step 1: 失敗するテストを書く**

Create `src/repositories/inMemoryInventoryRepository.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { InMemoryInventoryRepository } from './inMemoryInventoryRepository'

function makeRepo() {
  let n = 0
  return new InMemoryInventoryRepository({
    idFactory: () => `id-${++n}`,
    clock: () => '2026-06-23T00:00:00.000Z',
  })
}

describe('InMemoryInventoryRepository', () => {
  it('adds and lists items per user', async () => {
    const repo = makeRepo()
    await repo.add('u1', { name: '卵', quantityText: '2個' })
    await repo.add('u2', { name: '牛乳', quantityText: '1本' })
    const u1 = await repo.list('u1')
    expect(u1).toHaveLength(1)
    expect(u1[0].name).toBe('卵')
  })

  it('updates quantity of an existing item', async () => {
    const repo = makeRepo()
    const added = await repo.add('u1', { name: '卵', quantityText: '2個' })
    const updated = await repo.updateQuantity('u1', added.id, '1個')
    expect(updated.quantityText).toBe('1個')
    expect((await repo.list('u1'))[0].quantityText).toBe('1個')
  })

  it('removes an item', async () => {
    const repo = makeRepo()
    const added = await repo.add('u1', { name: '卵', quantityText: '2個' })
    await repo.remove('u1', added.id)
    expect(await repo.list('u1')).toHaveLength(0)
  })

  it('does not let one user touch another user item', async () => {
    const repo = makeRepo()
    const added = await repo.add('u1', { name: '卵', quantityText: '2個' })
    await expect(repo.updateQuantity('u2', added.id, '1個')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- inMemory`
Expected: FAIL（クラス未定義）。

- [ ] **Step 3: インターフェースを書く**

Create `src/repositories/inventoryRepository.ts`:
```ts
import type { InventoryItem, NewInventoryInput } from '@/domain/inventory'

export interface InventoryRepository {
  list(userId: string): Promise<InventoryItem[]>
  add(userId: string, input: NewInventoryInput): Promise<InventoryItem>
  updateQuantity(userId: string, id: string, quantityText: string): Promise<InventoryItem>
  remove(userId: string, id: string): Promise<void>
}
```

- [ ] **Step 4: インメモリ実装を書く**

Create `src/repositories/inMemoryInventoryRepository.ts`:
```ts
import type { InventoryItem, NewInventoryInput } from '@/domain/inventory'
import { buildInventoryItem, applyQuantityChange } from '@/domain/inventory'
import type { InventoryRepository } from './inventoryRepository'

type Deps = { idFactory: () => string; clock: () => string }

export class InMemoryInventoryRepository implements InventoryRepository {
  private items: InventoryItem[] = []
  constructor(private deps: Deps) {}

  async list(userId: string): Promise<InventoryItem[]> {
    return this.items.filter((i) => i.userId === userId)
  }

  async add(userId: string, input: NewInventoryInput): Promise<InventoryItem> {
    const item = buildInventoryItem(input, {
      id: this.deps.idFactory(),
      userId,
      now: this.deps.clock(),
    })
    this.items.push(item)
    return item
  }

  async updateQuantity(userId: string, id: string, quantityText: string): Promise<InventoryItem> {
    const item = this.items.find((i) => i.id === id && i.userId === userId)
    if (!item) throw new Error(`inventory item not found: ${id}`)
    const updated = applyQuantityChange(item, quantityText, this.deps.clock())
    Object.assign(item, updated)
    return item
  }

  async remove(userId: string, id: string): Promise<void> {
    const idx = this.items.findIndex((i) => i.id === id && i.userId === userId)
    if (idx === -1) throw new Error(`inventory item not found: ${id}`)
    this.items.splice(idx, 1)
  }
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test -- inMemory`
Expected: PASS（4 passed）。

- [ ] **Step 6: Commit**

```bash
git add src/repositories/inventoryRepository.ts src/repositories/inMemoryInventoryRepository.ts src/repositories/inMemoryInventoryRepository.test.ts
git commit -m "feat: add inventory repository interface and in-memory impl"
```

---

## Task 5: Supabaseスキーマ（SQLマイグレーション）

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Consumes: なし（DBスキーマ定義）
- Produces: `inventory_items` テーブル等。Task 7のSupabaseリポジトリが対象とするスキーマ。

> 注: このタスクはSQLファイルを書くだけで、適用（鍵が必要）はTask 7で行う。

- [ ] **Step 1: マイグレーションSQLを書く**

Create `supabase/migrations/0001_init.sql`:
```sql
-- 食材マスタ（将来の正規化用。本マイルストーンでは任意参照）
create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  default_unit text
);

-- 在庫
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  quantity_text text not null,
  quantity_num numeric,
  unit_text text,
  expires_at date,
  source text not null default 'manual'
    check (source in ('receipt', 'fridge_photo', 'manual', 'chat')),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_items_user_idx on inventory_items (user_id);

-- 行レベルセキュリティ: 自分の在庫だけ読み書き可
alter table inventory_items enable row level security;

create policy "own inventory select" on inventory_items
  for select using (auth.uid() = user_id);
create policy "own inventory insert" on inventory_items
  for insert with check (auth.uid() = user_id);
create policy "own inventory update" on inventory_items
  for update using (auth.uid() = user_id);
create policy "own inventory delete" on inventory_items
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add initial Supabase schema for inventory"
```

---

## Task 6: Supabaseクライアントと認証（鍵が必要）

> **このタスクはSupabaseプロジェクトのURL/anonキーが必要。** 実行者は事前に `.env.local` を用意すること（`.env.local.example` 参照）。鍵が無ければここで一旦停止し、ユーザーに依頼する。

**Files:**
- Create: `src/lib/supabaseClient.ts`, `src/app/login/page.tsx`, `src/app/(app)/layout.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: 環境変数 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Produces:
  - `function createBrowserSupabase(): SupabaseClient`
  - `function getServerSupabase(): SupabaseClient`（API Routeで使用、Cookieからセッション取得）
  - ログイン画面、認証必須の `(app)` レイアウト

- [ ] **Step 1: Supabase SDKを導入**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: クライアント生成モジュールを書く**

Create `src/lib/supabaseClient.ts`:
```ts
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createBrowserSupabase() {
  return createBrowserClient(url, anonKey)
}

export async function getServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      },
    },
  })
}
```

- [ ] **Step 3: ログイン画面（メールOTP/マジックリンク）を書く**

Create `src/app/login/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const supabase = createBrowserSupabase()

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    await supabase.auth.signInWithOtp({ email })
    setSent(true)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-bold">OKRecipe ログイン</h1>
      {sent ? (
        <p>メールに届いたリンクからログインしてください。</p>
      ) : (
        <form onSubmit={signIn} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            className="rounded border p-3"
          />
          <button className="rounded bg-black p-3 text-white">ログインリンクを送る</button>
        </form>
      )}
    </main>
  )
}
```

- [ ] **Step 4: 認証必須レイアウトを書く**

Create `src/app/(app)/layout.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabaseClient'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getServerSupabase()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <div className="mx-auto max-w-md p-4">{children}</div>
}
```

- [ ] **Step 5: ルートを在庫画面へリダイレクト**

Replace `src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/inventory')
}
```

- [ ] **Step 6: 起動して手動確認**

`.env.local` を用意した上で Run: `npm run dev`
Expected: `/` → 未ログインなら `/login` にリダイレクトされる。ログインリンクでログインできる。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Supabase client and email auth"
```

---

## Task 7: Supabase在庫リポジトリと在庫API

> Task 6の鍵が前提。

**Files:**
- Create: `src/repositories/supabaseInventoryRepository.ts`, `src/app/api/inventory/route.ts`, `src/app/api/inventory/[id]/route.ts`

**Interfaces:**
- Consumes: `InventoryRepository`（Task 4）, `getServerSupabase`（Task 6）, `parseQuantity`（Task 2）
- Produces:
  - `class SupabaseInventoryRepository implements InventoryRepository`（コンストラクタで `SupabaseClient` を受け取る）
  - `GET /api/inventory` → `InventoryItem[]`
  - `POST /api/inventory` body `{ name, quantityText }` → `InventoryItem`
  - `PATCH /api/inventory/:id` body `{ quantityText }` → `InventoryItem`
  - `DELETE /api/inventory/:id` → `204`

- [ ] **Step 1: Supabaseリポジトリを書く**

Create `src/repositories/supabaseInventoryRepository.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { InventoryItem, NewInventoryInput } from '@/domain/inventory'
import { parseQuantity } from '@/domain/quantity'
import type { InventoryRepository } from './inventoryRepository'

type Row = {
  id: string
  user_id: string
  name: string
  quantity_text: string
  quantity_num: number | null
  unit_text: string | null
  expires_at: string | null
  source: InventoryItem['source']
  updated_at: string
}

function toItem(r: Row): InventoryItem {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    quantityText: r.quantity_text,
    quantityNum: r.quantity_num,
    unitText: r.unit_text,
    expiresAt: r.expires_at,
    source: r.source,
    updatedAt: r.updated_at,
  }
}

export class SupabaseInventoryRepository implements InventoryRepository {
  constructor(private sb: SupabaseClient) {}

  async list(userId: string): Promise<InventoryItem[]> {
    const { data, error } = await this.sb
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data as Row[]).map(toItem)
  }

  async add(userId: string, input: NewInventoryInput): Promise<InventoryItem> {
    const q = parseQuantity(input.quantityText)
    const { data, error } = await this.sb
      .from('inventory_items')
      .insert({
        user_id: userId,
        name: input.name.trim(),
        quantity_text: q.text,
        quantity_num: q.num,
        unit_text: q.unit,
        source: input.source ?? 'manual',
        expires_at: input.expiresAt ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return toItem(data as Row)
  }

  async updateQuantity(userId: string, id: string, quantityText: string): Promise<InventoryItem> {
    const q = parseQuantity(quantityText)
    const { data, error } = await this.sb
      .from('inventory_items')
      .update({
        quantity_text: q.text,
        quantity_num: q.num,
        unit_text: q.unit,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()
    if (error) throw error
    return toItem(data as Row)
  }

  async remove(userId: string, id: string): Promise<void> {
    const { error } = await this.sb
      .from('inventory_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (error) throw error
  }
}
```

- [ ] **Step 2: 一覧/追加APIを書く**

Create `src/app/api/inventory/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseClient'
import { SupabaseInventoryRepository } from '@/repositories/supabaseInventoryRepository'

export async function GET() {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const repo = new SupabaseInventoryRepository(sb)
  return NextResponse.json(await repo.list(auth.user.id))
}

export async function POST(req: Request) {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body?.name || !body?.quantityText) {
    return NextResponse.json({ error: 'name and quantityText required' }, { status: 400 })
  }
  const repo = new SupabaseInventoryRepository(sb)
  const item = await repo.add(auth.user.id, { name: body.name, quantityText: body.quantityText })
  return NextResponse.json(item, { status: 201 })
}
```

- [ ] **Step 3: 更新/削除APIを書く**

Create `src/app/api/inventory/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseClient'
import { SupabaseInventoryRepository } from '@/repositories/supabaseInventoryRepository'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body?.quantityText) {
    return NextResponse.json({ error: 'quantityText required' }, { status: 400 })
  }
  const repo = new SupabaseInventoryRepository(sb)
  return NextResponse.json(await repo.updateQuantity(auth.user.id, id, body.quantityText))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const repo = new SupabaseInventoryRepository(sb)
  await repo.remove(auth.user.id, id)
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 4: マイグレーションを適用して手動確認**

Supabaseダッシュボードの SQL Editor で `supabase/migrations/0001_init.sql` を実行。
`npm run dev` で起動し、ログイン後にブラウザのDevToolsから:
```js
await fetch('/api/inventory', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({name:'卵', quantityText:'2個'})}).then(r=>r.json())
await fetch('/api/inventory').then(r=>r.json())
```
Expected: 追加した在庫が一覧に返る。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Supabase inventory repository and API routes"
```

---

## Task 8: 在庫一覧UI（モバイルファースト）

> Task 7の鍵・APIが前提。

**Files:**
- Create: `src/components/InventoryList.tsx`, `src/components/InventoryItemForm.tsx`, `src/app/(app)/inventory/page.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/inventory`, `PATCH/DELETE /api/inventory/:id`（Task 7）, `InventoryItem`型（Task 3）
- Produces: 在庫一覧画面（追加フォーム + 一覧 + 各行の個数編集/削除）

- [ ] **Step 1: 追加フォームコンポーネントを書く**

Create `src/components/InventoryItemForm.tsx`:
```tsx
'use client'
import { useState } from 'react'

export function InventoryItemForm({ onAdd }: { onAdd: (name: string, quantityText: string) => void }) {
  const [name, setName] = useState('')
  const [quantityText, setQuantityText] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !quantityText.trim()) return
    onAdd(name.trim(), quantityText.trim())
    setName('')
    setQuantityText('')
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="食材名"
        className="flex-1 rounded border p-2"
      />
      <input
        value={quantityText}
        onChange={(e) => setQuantityText(e.target.value)}
        placeholder="例: 2個 / 一人前分"
        className="w-32 rounded border p-2"
      />
      <button className="rounded bg-black px-3 text-white">追加</button>
    </form>
  )
}
```

- [ ] **Step 2: 一覧コンポーネントを書く**

Create `src/components/InventoryList.tsx`:
```tsx
'use client'
import type { InventoryItem } from '@/domain/inventory'

export function InventoryList({
  items,
  onUpdate,
  onRemove,
}: {
  items: InventoryItem[]
  onUpdate: (id: string, quantityText: string) => void
  onRemove: (id: string) => void
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-gray-500">在庫がありません。追加してください。</p>
  }
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2 py-3">
          <span className="flex-1 font-medium">{item.name}</span>
          <input
            defaultValue={item.quantityText}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== item.quantityText) onUpdate(item.id, v)
            }}
            className="w-28 rounded border p-1 text-right"
          />
          <button onClick={() => onRemove(item.id)} className="px-2 text-red-600" aria-label="削除">
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: 在庫画面（データ取得 + 操作配線）を書く**

Create `src/app/(app)/inventory/page.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import type { InventoryItem } from '@/domain/inventory'
import { InventoryList } from '@/components/InventoryList'
import { InventoryItemForm } from '@/components/InventoryItemForm'

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])

  async function reload() {
    const res = await fetch('/api/inventory')
    if (res.ok) setItems(await res.json())
  }
  useEffect(() => {
    reload()
  }, [])

  async function add(name: string, quantityText: string) {
    await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, quantityText }),
    })
    reload()
  }
  async function update(id: string, quantityText: string) {
    await fetch(`/api/inventory/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quantityText }),
    })
    reload()
  }
  async function remove(id: string) {
    await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
    reload()
  }

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">在庫</h1>
      <InventoryItemForm onAdd={add} />
      <InventoryList items={items} onUpdate={update} onRemove={remove} />
    </main>
  )
}
```

- [ ] **Step 4: 起動して手動確認**

Run: `npm run dev`
Expected: ログイン後 `/inventory` で在庫を追加・個数変更（フォーカスを外すと保存）・削除でき、リロードしても保持される。スマホ幅でレイアウトが崩れない。

- [ ] **Step 5: 型チェック/ビルド確認**

Run: `npm run build`
Expected: ビルド成功（型エラーなし）。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add mobile-first inventory management UI"
```

---

## Self-Review チェック結果

- **スペック網羅**: 在庫の手動CRUD（追加/個数変更/削除）= Task 4,7,8。自然言語の単位 = Task 2,3。認証（2人→公開） = Task 6 + RLS(Task 5)。`source` 区別 = Task 3,5,7。データの真実を独立システムが持つ分離 = リポジトリ抽象(Task 4)。写真取り込み・AI対話・レシピは本計画のスコープ外（計画2〜4）。
- **プレースホルダ**: なし（各ステップに実コードを記載）。
- **型整合性**: `InventoryItem` / `NewInventoryInput` / `parseQuantity` / `InventoryRepository` のシグネチャは Task 2→3→4→7 で一貫。
- **鍵が必要な箇所**: Task 6で初めてSupabase鍵が必要（明記済み）。Task 1〜5は鍵なしで完了・テスト可能。
