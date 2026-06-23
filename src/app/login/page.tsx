'use client'
import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabaseBrowser'
import { ui } from '@/components/ui'

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
        setError('セッションを作成できませんでした。Supabaseで「Confirm email」をOFFにしてください。')
        return
      }
      window.location.assign('/chat')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">OKRecipe</h1>
        <p className="mt-1 text-sm text-zinc-500">冷蔵庫の食材から、使い切るレシピを。</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          run('login')
        }}
        className={`${ui.card} flex flex-col gap-3 p-5`}
      >
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          className={`${ui.input} w-full`}
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード（6文字以上）"
          className={`${ui.input} w-full`}
        />
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>
        )}
        <button disabled={busy} className={`${ui.btnPrimary} w-full`}>
          {busy ? '処理中…' : 'ログイン'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run('signup')}
          className={`${ui.btnSecondary} w-full`}
        >
          {busy ? '処理中…' : '新規登録（初回のみ）'}
        </button>
      </form>
    </main>
  )
}
