'use client'
import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabaseBrowser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [supabase] = useState(() => createBrowserSupabase())

  async function run(mode: 'login' | 'signup') {
    setError(null)
    setBusy(true)
    try {
      const fn =
        mode === 'login'
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({ email, password })
      const { data, error } = await fn
      if (error) {
        setError(error.message)
        return
      }
      if (!data.session) {
        // メール確認が有効なまま signup した場合などセッションが無いケース
        setError('セッションを作成できませんでした。Supabaseで「Confirm email」をOFFにしてください。')
        return
      }
      window.location.assign('/inventory')
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setBusy(false)
    }
    // 成功時は Google へリダイレクトされるのでここには戻らない
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-bold">OKRecipe ログイン</h1>

      <button
        type="button"
        disabled={busy}
        onClick={google}
        className="flex items-center justify-center gap-2 rounded border p-3 font-medium"
      >
        <span className="text-lg">G</span> Googleでログイン
      </button>

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        または メールアドレス
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          run('login')
        }}
        className="flex flex-col gap-3"
      >
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          className="rounded border p-3"
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード（6文字以上）"
          className="rounded border p-3"
        />
        {error && (
          <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p>
        )}
        <button disabled={busy} className="rounded bg-black p-3 text-white disabled:opacity-50">
          {busy ? '処理中…' : 'ログイン'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run('signup')}
          className="rounded border p-3 disabled:opacity-50"
        >
          {busy ? '処理中…' : '新規登録（初回のみ）'}
        </button>
      </form>
    </main>
  )
}
