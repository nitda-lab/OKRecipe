# デプロイ手順（Vercel）

OKRecipe を Vercel に公開する手順。GitHub 連携により、以後 `main` に push すると自動デプロイされる。

## 前提
- GitHub リポジトリ: https://github.com/nitda-lab/OKRecipe （push 済み）
- Supabase プロジェクト: 稼働中（テーブル・RLS 適用済み）
- 認証: メール+パスワード（リダイレクト設定不要）。Google ログインを本番で使う場合のみ、後述の Redirect URL 設定が必要。

## 手順（Vercel ダッシュボード）

1. https://vercel.com に GitHub アカウントでログイン
2. **Add New… → Project**
3. **Import** で `nitda-lab/OKRecipe` を選択（GitHub 連携で nitda-lab へのアクセス許可が必要）
4. Framework は **Next.js** が自動検出される。ビルド設定は既定のままでよい
5. **Environment Variables** に以下を設定（値は手元の `.env.local` からコピー。`SUPABASE_DB_URL` は本番に入れない＝マイグレーション専用）

   | Name | 値の元 | 種別 |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | .env.local の同名 | 公開可 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | .env.local の同名（sb_publishable_…） | 公開可 |
   | `AI_BASE_URL` | `https://nano-gpt.com/v1` | サーバー専用 |
   | `AI_API_KEY` | .env.local の同名（sk-nano-…） | **秘密** |
   | `AI_CHAT_MODEL` | `openai/gpt-oss-120b` | サーバー専用 |
   | `AI_VISION_MODEL` | `google/gemma-4-31b-it` | サーバー専用 |

6. **Deploy** をクリック。数分で `https://<プロジェクト名>.vercel.app` が発行される

## デプロイ後の設定

### メール+パスワード認証
追加設定は不要。発行された URL でそのままログインできる。

### Google ログインを本番でも使う場合
Supabase ダッシュボード → **Authentication → URL Configuration**：
- **Site URL** に本番 URL（`https://<プロジェクト名>.vercel.app`）
- **Redirect URLs** に `https://<プロジェクト名>.vercel.app/**` を追加

Google Cloud Console 側の承認済みリダイレクト URI に
`https://szenodbdyqbmharrskyj.supabase.co/auth/v1/callback` が入っていることも確認。

## 以後の更新
`main` に push すると Vercel が自動でビルド・デプロイする。手動操作は不要。

## DB マイグレーション（スキーマ変更時）
本番 DB は Supabase のまま。新しい `supabase/migrations/*.sql` を追加したら、ローカルで：
```bash
node --env-file=.env.local scripts/apply-migration.mjs supabase/migrations/<file>.sql
```
（アプリのデプロイとは独立。DB は Supabase が単一の本番）
