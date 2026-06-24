'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { InventoryItem } from '@/domain/inventory'
import { InventoryList } from '@/components/InventoryList'
import { InventoryItemForm } from '@/components/InventoryItemForm'
import { ui } from '@/components/ui'

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loaded, setLoaded] = useState(false)

  async function reload() {
    const res = await fetch('/api/inventory')
    if (res.ok) setItems(await res.json())
    setLoaded(true)
  }
  useEffect(() => {
    reload()
  }, [])

  async function add(name: string, quantityText: string) {
    await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, quantityText }),
    })
    reload()
  }
  async function update(id: string, quantityText: string) {
    await fetch(`/api/inventory/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quantityText }),
    })
    reload()
  }
  async function remove(id: string) {
    await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
    reload()
  }

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className={ui.h1}>冷蔵庫</h1>
        <Link href="/ingest" className={ui.btnSecondarySm}>
          📷 写真で取り込み
        </Link>
      </div>
      <InventoryItemForm onAdd={add} />
      {loaded ? (
        <InventoryList items={items} onUpdate={update} onRemove={remove} />
      ) : (
        <p className="py-10 text-center text-sm text-zinc-400">読み込み中…</p>
      )}
    </main>
  )
}
