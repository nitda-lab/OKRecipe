@AGENTS.md

# OKRecipe

冷蔵庫の食材を管理し、それを使い切るレシピをAIが提案するモバイルファーストのWebアプリ。
手入力を避け、レシート/冷蔵庫の写真から食材を取り込む。ユーザーは2人（個人運用、将来公開も視野）。

## よく使うコマンド

```bash
npm run dev -- -H 0.0.0.0   # 開発サーバー（スマホ実機からも見れるよう全IFで待受）
npm test                    # Vitest（全テスト）
npm test -- <name>          # 部分実行（例: npm test -- quantity）
npm run build               # 本番ビルド（型チェック込み）。コミット前に必ず通すこと
npm run lint                # ESLint。コミット前に通す
# DBマイグレーション適用（スキーマ追加時）
node --env-file=.env.local scripts/apply-migration.mjs supabase/migrations/<file>.sql
```

開発の基本サイクル: **失敗するテストを書く → 実装 → テスト通過 → lint/build → コミット**（TDD）。
変更ごとに小さくコミットし、`main` に push すると Vercel が自動デプロイする。

## 技術スタック

- **Next.js 16（App Router, src/ディレクトリ, TypeScript strict）** + Tailwind CSS v4
- **Supabase**: 認証（メール+パスワード）/ Postgres / RLS
- **AI**: nanoGPT（OpenAI互換API）。対話・画像認識・下書き修正すべてに使用
- **テスト**: Vitest（実APIは叩かずモック注入）

## アーキテクチャ（レイヤリング）

データの「真実」は常にリポジトリ（DB）が持ち、AIやUIはそれを読み書きするだけ、という分離を貫く。

```
ドメイン(src/domain)         … 純粋ロジック・型（DB非依存・ユニットテスト）
  ↓
リポジトリ(src/repositories) … インターフェース + InMemory実装(テスト用) + Supabase実装(本番)
  ↓
API Route(src/app/api)       … 認証 + リポジトリ呼び出し
  ↓
UI(src/components, src/app)  … 画面

AI層(src/lib/ai)             … OpenAI互換プロバイダ。tools経由でリポジトリを操作（直接DBは触らない）
```

**重要な原則**: AIは在庫やレシピを直接DBに書かない。チャットでは「保留アクション(PendingAction)」を返し、
ユーザーが確認ボタンを押して初めて既存のAPI（/api/inventory, /api/recipes）経由で反映する。
これにより変更経路が一本化され、誤操作を防ぐ。

## ディレクトリ構成（要点）

```
src/domain/             quantity.ts(自然言語の個数パース), inventory.ts(在庫型・操作)
src/repositories/       <name>Repository.ts(IF) + inMemory<Name>... + supabase<Name>...
src/lib/ai/             provider.ts(チャット), vision.ts(画像→食材抽出), draftEdit.ts(下書き修正),
                        chatAgent.ts(エージェントループ+SYSTEM_PROMPT), inventoryTools.ts(tool定義+executeTool),
                        stream.ts(SSEパース), types.ts
src/lib/                supabaseServer.ts / supabaseBrowser.ts, apiAuth.ts(requireUser), markdown.ts(正規化)
src/app/api/            inventory, recipes, conversations, ingest(+edit), chat(NDJSONストリーム)
src/app/(app)/          inventory, ingest, chat, recipes（認証必須レイアウト配下）
src/components/         画面コンポーネント + ui.ts(デザインシステム) + useToast + NavBar
supabase/migrations/    0001..0004（在庫/会話/取り込みログ/レシピ）
docs/superpowers/       specs(設計) と plans(実装計画)
```

## 主要な規約・パターン

- **リポジトリパターン**: 新しい永続データは「IF + InMemory(テスト) + Supabase(本番)」の3点セットで作る。
  InMemory実装に `idFactory`/`clock` を注入してテストを決定的にする。
- **API認証**: 全API Routeの冒頭で `requireUser()`（src/lib/apiAuth.ts）を使う。
  ```ts
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { sb, userId } = auth
  ```
- **デザイン**: モダン・ニュートラル(zinc系)。ボタン/入力/カード等は `src/components/ui.ts` の定数を使い、見た目を統一する。
  Markdown表示用の長いクラスは `markdownStyles.ts` の `MARKDOWN_TYPO`。
- **Markdown描画**: AI出力は崩れがちなので、ReactMarkdown(+remark-gfm)に渡す前に `normalizeMarkdown()` を通す
  （`##見出し`→`## 見出し` のスペース補完、全体を囲むコードフェンス除去）。
- **個数は自然言語**: 「2個」「一人前分」等をそのまま保持（`quantity_text`が真）。厳密な数値計算はしない。

## AI（nanoGPT）

- nanoGPTの**サブスクは有料クローズドモデル（gpt-4o等）が使えない**。tool calling対応のオープンモデルを使う。
- 既定モデル（環境変数で上書き可）:
  - `AI_CHAT_MODEL=google/gemma-4-31b-it`（対話・tool calling・下書き修正）
  - `AI_VISION_MODEL=google/gemma-4-31b-it`（画像→食材抽出。実画像で精度検証して選定）
- チャットは **NDJSONストリーミング**（/api/chat）。`runChatAgentStream` がツール往復をこなし、
  最終回答のトークンを逐次返す。`max_tokens` は4000（小さいと長文が途中で切れる）。
- 画像は `image_url`(base64 data URL) で送る。`vision.ts` の `parseExtraction` が ```json フェンスを剥がして配列化。

## 認証（Supabase）

- **メール+パスワードのみ**（Googleログインは削除済み）。Supabase側で Email プロバイダ有効化・
  「Confirm email」OFF・「Allow new users to sign up」ON が前提。
- セッション同期に `src/middleware.ts` が必須（無いとログインしてもサーバーが認識せずログイン画面に戻る）。
- ブラウザ用は `supabaseBrowser.ts`、サーバー用は `supabaseServer.ts`（`next/headers` 依存のため分離。混在させない）。

## DB / マイグレーション

- スキーマは `supabase/migrations/*.sql`。全テーブルに **RLS** を設定し、`auth.uid() = user_id` で本人のみ許可。
- 適用は `scripts/apply-migration.mjs`（`SUPABASE_DB_URL` を使い pg で直接実行）。本番DBはSupabase単一。

## 環境変数（.env.local。.env.local.example 参照）

```
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY  # 公開可（クライアント）
SUPABASE_DB_URL          # マイグレーション専用（本番アプリには不要・Vercelに入れない）
AI_BASE_URL / AI_API_KEY / AI_CHAT_MODEL / AI_VISION_MODEL # AI（サーバー専用）
```

## デプロイ

Vercel（GitHub連携・push自動デプロイ）。手順は `DEPLOY.md`。
本番に入れる環境変数は NEXT_PUBLIC_* と AI_*（`SUPABASE_DB_URL` は入れない）。

## 注意点（ハマりどころ）

- **iOS自動ズーム**: 入力欄フォントが16px未満だとフォーカス時にズームする。`ui.input` は `text-base sm:text-sm`
  （モバイル16px / PC14px）にしてある。新規入力欄も同様にすること。
- **Node の fetch は `Referer` を落とす**（禁止ヘッダー）。Referer必須の外部API（楽天レシピ等）は `node:https` を使う。
- **ページ幅**: `scrollbar-gutter: stable`（globals.css）でスクロールバー有無による幅ブレを防止。上部バーは全幅、本文は `max-w-md`。
- **改行コード**: コミット時に LF→CRLF 警告が出るが無害（Windows環境）。
- **未着手/保留**: 楽天レシピAPI連携は保留（Referer許可ドメイン要設定）。スマホの一部ブラウザでログイン画面が
  ハイドレーションしない事象は未解決（PCは正常）。
