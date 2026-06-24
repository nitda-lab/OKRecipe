'use client'
import type { InventoryItem } from '@/domain/inventory'
import { ui } from '@/components/ui'

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
    return (
      <p className="py-10 text-center text-sm text-zinc-400">
        冷蔵庫は空です。食材を追加してください。
      </p>
    )
  }
  return (
    <ul className={`${ui.card} divide-y divide-zinc-100`}>
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2 px-3 py-2.5">
          <span className="flex-1 truncate text-sm font-medium text-zinc-800">{item.name}</span>
          <input
            defaultValue={item.quantityText}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== item.quantityText) onUpdate(item.id, v)
            }}
            className="w-24 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-right text-base outline-none focus:border-zinc-400 focus:bg-white sm:text-sm"
          />
          <button
            onClick={() => onRemove(item.id)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
            aria-label="削除"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}
