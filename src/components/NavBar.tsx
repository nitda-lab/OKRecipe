import Link from 'next/link'

export function NavBar() {
  return (
    <nav className="mb-4 flex gap-4 border-b pb-2 text-sm">
      <Link href="/inventory" className="font-medium">在庫</Link>
      <Link href="/ingest" className="font-medium">取り込み</Link>
      <Link href="/chat" className="font-medium">チャット</Link>
    </nav>
  )
}
