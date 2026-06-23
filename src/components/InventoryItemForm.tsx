'use client'
import { useState } from 'react'

export function InventoryItemForm({ onAdd }: { onAdd: (name: string, quantityText: string) => void }) {
  const [name, setName] = useState('')
  const [quantityText, setQuantityText] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !quantityText.trim()) return
    onAdd(name.trim(), quantityText.trim())
    setName('')
    setQuantityText('')
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="食材名"
        className="flex-1 rounded border p-2"
      />
      <input
        value={quantityText}
        onChange={(e) => setQuantityText(e.target.value)}
        placeholder="例: 2個 / 一人前分"
        className="w-32 rounded border p-2"
      />
      <button className="rounded bg-black px-3 text-white">追加</button>
    </form>
  )
}
