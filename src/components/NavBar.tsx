'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/inventory', label: '在庫' },
  { href: '/ingest', label: '取り込み' },
  { href: '/chat', label: 'チャット' },
  { href: '/recipes', label: 'レシピ' },
]

export function NavBar() {
  const pathname = usePathname()
  return (
    <nav className="sticky top-0 z-20 mb-4 flex gap-1 border-b bg-white px-4 pt-3 pb-1 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'rounded-t border-b-2 border-black bg-gray-100 px-3 py-1 font-bold text-black'
                : 'rounded-t px-3 py-1 font-medium text-gray-500 hover:text-black'
            }
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
