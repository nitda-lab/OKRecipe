'use client'
import { useEffect, useState } from 'react'
import type { InventoryItem } from '@/domain/inventory'
import { InventoryList } from '@/components/InventoryList'
import { InventoryItemForm } from '@/components/InventoryItemForm'

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])

  async function reload() {
    const res = await fetch('/api/inventory')
    if (res.ok) setItems(await res.json())
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
      <h1 className="text-lg font-bold">在庫</h1>
      <InventoryItemForm onAdd={add} />
      <InventoryList items={items} onUpdate={update} onRemove={remove} />
    </main>
  )
}
