'use client'
import { useState } from 'react'
import type { InventoryItem } from '@/domain/inventory'
import { ui } from '@/components/ui'

export function InventoryList({
  items,
  onUpdate,
  onRemove,
  onRemoveMany,
}: {
  items: InventoryItem[]
  onUpdate: (id: string, quantityText: string) => void
  onRemove: (id: string) => void
  onRemoveMany: (ids: string[]) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-zinc-400">
        冷蔵庫は空です。食材を追加してください。
      </p>
    )
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = items.every((i) => selected.has(i.id))
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
  }

  function removeOne(item: InventoryItem) {
    if (!window.confirm(`「${item.name}」を削除しますか？`)) return
    onRemove(item.id)
    setSelected((prev) => {
      if (!prev.has(item.id)) return prev
      const next = new Set(prev)
      next.delete(item.id)
      return next
    })
  }

  function removeSelected() {
    const ids = items.filter((i) => selected.has(i.id)).map((i) => i.id)
    if (ids.length === 0) return
    if (!window.confirm(`選択した${ids.length}件を削除しますか？`)) return
    onRemoveMany(ids)
    setSelected(new Set())
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 px-1">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            aria-label="全選択"
            className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
          />
          全選択
        </label>
        {selected.size > 0 && (
          <button
            onClick={removeSelected}
            className="ml-auto inline-flex items-center rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            選択した{selected.size}件を削除
          </button>
        )}
      </div>
      <ul className={`${ui.card} divide-y divide-zinc-100`}>
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 px-3 py-2.5">
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => toggle(item.id)}
              aria-label={`${item.name}を選択`}
              className="h-4 w-4 shrink-0 rounded border-zinc-300 accent-zinc-900"
            />
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
              onClick={() => removeOne(item)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
              aria-label="削除"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
