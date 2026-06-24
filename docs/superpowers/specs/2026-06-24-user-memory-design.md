# ユーザーメモリ（ChatGPT式）+ ナビ整理 設計書

- 作成日: 2026-06-24
- ブランチ: feature/user-memory

## 概要 / 目的

ChatGPT式の「ユーザーメモリ」を導入し、料理・食事に関わる事実（人数・アレルギー・苦手食材・時短志向・調理器具など）をAIが会話から**自動で記憶**し、以後のレシピ・献立提案をパーソナライズする。あわせて上部メニューを整理し、メモリ機能をユーザーアイコンのメニューに収める（メニューを増やさない）。

## スコープ

- ユーザーメモリ: 記憶の自動保存（確認なし）、一覧・削除、SYSTEM_PROMPTへの差し込み。
- 記憶の対象は**料理・食事に関係する事実に限定**（雑談・一時的発言は記憶しない）。
- ナビ整理: 上部タブを「チャット / 冷蔵庫 / レシピ」に。取り込みは冷蔵庫ページから。ユーザーアイコンのドロップダウンに「メモリ」「ログアウト」。

## データモデル

```
memories（RLS・本人のみ）
  id uuid pk
  user_id uuid -> auth.users
  text text not null         -- 記憶1件（短い事実）
  created_at timestamptz
```
- 1件＝短いテキスト。ON/OFFは持たず、不要なら削除（ChatGPT準拠でシンプルに）。

## AI連携（自動保存）

- チャットのツールに `remember(text)` を追加。ユーザーが料理・食事に関わる**継続しそうな事実**を述べたら、AIが**確認なしで即保存**する。
- `remember` は保留アクションではなく**即実行**: `executeTool` 内で MemoryRepository に保存し、保存した文言を `savedMemories` に積む。
- `runChatAgentStream` は実行後に保存メモリを返し、`/api/chat` が done イベントに `savedMemories` を含める。UIは「🧠 覚えました: ◯◯」をトースト表示。
- SYSTEM_PROMPT に保存済みメモリを差し込む（`buildSystemPrompt(memories)`）。空なら何も足さない。
- システムプロンプトに指示を追加: 「料理・食事に関係する継続的な事実だけ remember で記憶する。一時的・雑談的な内容は記憶しない。すでに記憶済みのことは重複保存しない。」

### 既存パターンの再利用
- MemoryRepository は在庫/レシピ同様に **IF + InMemory(テスト) + Supabase(本番)** の3点セット。
- ツールは `inventoryTools.ts` の `INVENTORY_TOOLS` に追加し、`executeTool` で分岐（在庫=保留 / レシピ保存=保留 / memory=即実行）。

## ナビ整理

- 上部タブ: **チャット / 冷蔵庫 / レシピ**（取り込みを削除）。
- 冷蔵庫ページ上部に「📷 写真で取り込み」ボタン → `/ingest`。
- 右上に**ユーザーアイコン**（円形・メール頭文字）。クリックでドロップダウン:
  - 「メモリ」→ `/memory`（記憶の一覧・手動追加・削除）
  - 「ログアウト」（現状のボタンをここへ移動）
- アイコン表示用のメール頭文字は、認証必須レイアウトからメールを prop で NavBar に渡す。

## API

- `GET /api/memories` → `Memory[]`
- `POST /api/memories` `{ text }` → `Memory`(201)
- `DELETE /api/memories/:id` → 204
- `/api/chat`: エージェント実行前に `MemoryRepository.list(userId)` を読み、`buildSystemPrompt` に渡す。実行後 `savedMemories` を done に含める。

## エラー処理・整合性

- メモリ保存失敗はチャットを壊さない（握りつぶし、ログのみ）。
- 重複保存はプロンプト指示で抑制（厳密な重複排除はしない＝YAGNI。気になればユーザーが削除）。
- 記憶対象の限定はプロンプトで担保。

## テスト

- MemoryRepository(InMemory): create/list/remove/ユーザー分離 をユニットテスト。
- `executeTool` の `remember`: InMemoryメモリrepoへ保存され savedMemories に積まれることをテスト。
- `buildSystemPrompt`: メモリ有無で出力が変わることをテスト。
- 実APIは叩かない（プロバイダはモック）。

## スコープ外（YAGNI / 将来）

- メモリの編集（今回は追加・削除のみ）、ON/OFFトグル、カテゴリ分け。
- 「忘れて」のチャット経由削除（将来 forget ツールで追加可能）。
- 記憶の重複自動マージ。
