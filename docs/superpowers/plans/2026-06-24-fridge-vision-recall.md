# 冷蔵庫写真の取りこぼし改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 冷蔵庫写真の食材抽出の取りこぼしを、プロンプトの網羅化と `max_tokens` の種別別引き上げで減らす。

**Architecture:** 変更は `src/lib/ai/vision.ts` のみ。冷蔵庫プロンプトを「間引け」から「網羅列挙」へ反転し、種別ごとの `max_tokens`（receipt:1000 / fridge:2500、`deps.maxTokens` で上書き可）を `extract(_, kind)` で選択する。出力形式（JSON配列）は不変のため `parseExtraction` も受信側（route/UI）も無変更。

**Tech Stack:** TypeScript (strict), Vitest（実APIは叩かずモック注入）。

## Global Constraints

- 出力形式は `[{"name":"卵","qty_text":"2個"}]`（JSON配列のみ）を維持する。`parseExtraction` 互換を壊さない。
- 実APIは叩かない。テストは `fetchFn` をモック注入する。
- レシートプロンプト・API Route・UI は変更しない（スコープ外）。
- コミット前に `npm run lint` と `npm run build` を通す。

---

### Task 1: `max_tokens` を種別ごとにし、冷蔵庫プロンプトを網羅化する

**Files:**
- Modify: `src/lib/ai/vision.ts`
- Test: `src/lib/ai/vision.test.ts`

**Interfaces:**
- Consumes: 既存 `createVisionExtractor(deps: VisionDeps)` と `extract(imageDataUrl, kind: 'receipt'|'fridge')`。
- Produces: `extract` のリクエスト body の `max_tokens` が `deps.maxTokens ?? { receipt: 1000, fridge: 2500 }[kind]`。シグネチャ変更なし。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/ai/vision.test.ts` の `describe('createVisionExtractor', ...)` 内に追記する:

```ts
  it('sends per-kind max_tokens (fridge 2500, receipt 1000)', async () => {
    const mk = () =>
      vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: '[]' } }] }),
          { status: 200 },
        ),
      )
    const base = { apiKey: 'k', baseUrl: 'https://x/v1', model: 'vm' }

    const fFridge = mk()
    await createVisionExtractor({ ...base, fetchFn: fFridge as unknown as typeof fetch })
      .extract('data:image/png;base64,AAAA', 'fridge')
    const bodyFridge = JSON.parse((fFridge.mock.calls[0][1] as RequestInit).body as string)
    expect(bodyFridge.max_tokens).toBe(2500)

    const fReceipt = mk()
    await createVisionExtractor({ ...base, fetchFn: fReceipt as unknown as typeof fetch })
      .extract('data:image/png;base64,AAAA', 'receipt')
    const bodyReceipt = JSON.parse((fReceipt.mock.calls[0][1] as RequestInit).body as string)
    expect(bodyReceipt.max_tokens).toBe(1000)
  })

  it('lets deps.maxTokens override the per-kind default', async () => {
    const f = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '[]' } }] }), { status: 200 }),
    )
    await createVisionExtractor({
      apiKey: 'k', baseUrl: 'https://x/v1', model: 'vm', maxTokens: 99,
      fetchFn: f as unknown as typeof fetch,
    }).extract('data:image/png;base64,AAAA', 'fridge')
    const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)
    expect(body.max_tokens).toBe(99)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- vision`
Expected: 新規2件が FAIL（`max_tokens` が現状 800 のため `2500`/`1000` と不一致）。既存テストは PASS。

- [ ] **Step 3: `max_tokens` を種別別にする実装**

`src/lib/ai/vision.ts` の `createVisionExtractor` を次のように変更する。

種別別の既定値マップを `PROMPTS` の近くに追加:

```ts
const MAX_TOKENS: Record<'receipt' | 'fridge', number> = {
  receipt: 1000,
  fridge: 2500,
}
```

`createVisionExtractor` 内の固定 `maxTokens` を撤廃し、`extract` 内で種別から解決する:

```ts
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
```

（`const maxTokens = deps.maxTokens ?? 800` の行は削除し、上記のように `extract` 内へ移す。）

- [ ] **Step 4: テストを実行して通過を確認**

Run: `npm test -- vision`
Expected: 全件 PASS（新規2件含む）。

- [ ] **Step 5: 冷蔵庫プロンプトを網羅化する**

`src/lib/ai/vision.ts` の `PROMPTS.fridge` を次の文面に差し替える（receipt はそのまま）:

```ts
  fridge:
    'この冷蔵庫の写真に見える食材を、できるだけ漏れなく全部列挙してJSON配列だけを返してください。形式: [{"name":"卵","qty_text":"2個"}]。棚→ドアポケット→引き出しの順に走査し、見えるものはすべて挙げる。一部しか見えない・包装で隠れていても、判別できれば挙げる。間引かない（調味料の小瓶なども含める）。個数や量が分かれば自然言語で、不明なら"あり"。食品・飲料・食材のみ（容器・家電・宣伝文は除外）。英語/ローマ字表記は日本語に直す。',
```

- [ ] **Step 6: lint と build を通す**

Run: `npm run lint`
Expected: エラーなし。

Run: `npm run build`
Expected: 型チェック込みで成功。

- [ ] **Step 7: コミット**

```bash
git add src/lib/ai/vision.ts src/lib/ai/vision.test.ts
git commit -m "feat: improve fridge photo recall (exhaustive prompt + per-kind max_tokens)"
```

---

## 手動検証（コミット後・別ステップ）

改訂前後で同じ冷蔵庫写真を `/ingest`（冷蔵庫モード）に投げ、取りこぼしが減るか目視比較する。
不足する場合は Approach B（vision モデル変更）または撮影経路の別件（`capture` 復活）へ進む。
