'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabaseBrowser'

const LINKS = [
  { href: '/chat', label: 'チャット' },
  { href: '/inventory', label: '冷蔵庫' },
  { href: '/ingest', label: '取り込み' },
  { href: '/recipes', label: 'レシピ' },
]

export function NavBar() {
  const pathname = usePathname()

  async function logout() {
    await createBrowserSupabase().auth.signOut()
    window.location.assign('/login')
  }

  return (
    <header className="sticky top-0 z-20 mb-4 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-sm font-semibold tracking-tight text-zinc-900">OKRecipe</span>
        <button
          onClick={logout}
          className="text-xs text-zinc-400 transition-colors hover:text-zinc-700"
        >
          ログアウト
        </button>
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
    </header>
  )
}
