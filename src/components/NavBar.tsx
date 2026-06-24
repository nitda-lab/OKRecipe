'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabaseBrowser'

const LINKS = [
  { href: '/chat', label: 'チャット' },
  { href: '/inventory', label: '冷蔵庫' },
  { href: '/recipes', label: 'レシピ' },
]

export function NavBar({ email }: { email?: string | null }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const initial = (email?.trim()?.[0] ?? 'U').toUpperCase()

  async function logout() {
    await createBrowserSupabase().auth.signOut()
    window.location.assign('/login')
  }

  return (
    <header className="sticky top-0 z-20 mb-4 w-full border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-sm font-semibold tracking-tight text-zinc-900">OKRecipe</span>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white"
              aria-label="ユーザーメニュー"
            >
              {initial}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                  {email && (
                    <p className="truncate px-3 py-1.5 text-xs text-zinc-400">{email}</p>
                  )}
                  <Link
                    href="/memory"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    メモリ
                  </Link>
                  <button
                    onClick={logout}
                    className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    ログアウト
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <nav className="flex flex-nowrap items-center gap-1 overflow-x-auto px-2 pt-1">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'shrink-0 whitespace-nowrap border-b-2 border-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-900'
                    : 'shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-700'
                }
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
