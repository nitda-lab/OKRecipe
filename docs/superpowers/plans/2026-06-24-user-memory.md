# ユーザーメモリ + ナビ整理 実装計画

> 設計: docs/superpowers/specs/2026-06-24-user-memory-design.md
> ブランチ: feature/user-memory

**Goal:** ChatGPT式メモリ（自動保存・SYSTEM_PROMPT差し込み・一覧/削除）と、ナビ整理（取り込みを冷蔵庫へ・ユーザーアイコンのメニュー）。

## タスク

1. **migration 0005_memories.sql + 適用**
   - memories(id, user_id, text, created_at), RLS（select/insert/delete own）。
2. **MemoryRepository**
   - `Memory={id,text,createdAt}`, `MemoryRepository{list,create,remove}`。InMemory + Supabase + テスト。
3. **/api/memories**
   - GET一覧 / POST作成 / DELETE。requireUser利用。
4. **remember ツール + SYSTEM_PROMPT**
   - `INVENTORY_TOOLS` に `remember(text)` 追加。
   - `executeTool` の Ctx に `memoryRepo?`, `savedMemories: string[]` を追加。remember は memoryRepo があれば即保存し savedMemories に積む。
   - `buildSystemPrompt(memories: string[])` を追加（base + 記憶差し込み）。SYSTEM_PROMPT に remember 指示を追記。
   - `runChatAgent`/`runChatAgentStream` の Deps に `memoryRepo?`, `memories?` を追加。戻り値に `savedMemories` を追加。
   - テスト: executeTool の remember 保存、buildSystemPrompt の差し込み、agent が savedMemories を返す。
5. **/api/chat 連携**
   - 実行前に memories 読込→agentへ。done イベントに `savedMemories` 追加。
6. **ナビ整理 + /memory UI**
   - NavBar: 取り込みリンク削除、右上ユーザーアイコン(email頭文字)ドロップダウン（メモリ/ログアウト）。email は layout から prop。
   - 冷蔵庫ページ: 「📷 写真で取り込み」ボタン → /ingest。
   - /memory ページ + Memory コンポーネント（一覧・手動追加・削除、トースト）。
   - Chat: done の savedMemories でトースト「🧠 覚えました: ◯◯」。
7. **build/lint/test、ブランチpush**

各タスクは失敗テスト→実装→通過→コミットのTDD。
