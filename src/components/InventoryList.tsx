'use client'
import type { InventoryItem } from '@/domain/inventory'

export function InventoryList({
  items,
  onUpdate,
  onRemove,
}: {
  items: InventoryItem[]
  onUpdate: (id: string, quantityText: string) => void
  onRemove: (id: string) => void
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-gray-500">在庫がありません。追加してください。</p>
  }
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2 py-3">
          <span className="flex-1 font-medium">{item.name}</span>
          <input
            defaultValue={item.quantityText}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== item.quantityText) onUpdate(item.id, v)
            }}
            className="w-28 rounded border p-1 text-right"
          />
          <button onClick={() => onRemove(item.id)} className="px-2 text-red-600" aria-label="削除">
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}
