'use client'
import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabaseBrowser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const supabase = createBrowserSupabase()

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
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
