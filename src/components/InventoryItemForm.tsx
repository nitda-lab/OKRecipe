'use client'
import { useState } from 'react'
import { ui } from '@/components/ui'

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
        className={`${ui.input} w-0 min-w-0 flex-1`}
      />
      <input
        value={quantityText}
        onChange={(e) => setQuantityText(e.target.value)}
        placeholder="例:2個"
        className={`${ui.input} w-20 shrink-0`}
      />
      <button className={`${ui.btnPrimary} shrink-0`}>追加</button>
    </form>
  )
}
