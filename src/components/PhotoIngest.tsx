'use client'
import { useState } from 'react'

type Kind = 'receipt' | 'fridge'
type Mode = 'add' | 'overwrite'
type Row = { name: string; qtyText: string }

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function PhotoIngest() {
  const [kind, setKind] = useState<Kind>('receipt')
  const [mode, setMode] = useState<Mode>('add')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 写真の種類を選ぶと、反映方法の既定値も合わせて切り替える（後から変更可）
  function pickKind(k: Kind) {
    setKind(k)
    setMode(k === 'receipt' ? 'add' : 'overwrite')
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError(null)
    setDone(false)
    try {
      const image = await fileToDataUrl(file)
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, kind }),
      })
      const data = await res.json()
      if (res.ok) setRows(data.items ?? [])
      else setError(data.error ?? 'failed')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, j) => j !== i))
  }
  function addRow() {
    setRows((rs) => [...rs, { name: '', qtyText: '' }])
  }

  async function apply() {
    setLoading(true)
    setError(null)
    try {
      if (mode === 'overwrite') {
        // 現状で上書き: 既存在庫を全削除してから追加
        const cur = await fetch('/api/inventory').then((r) => r.json())
        for (const it of cur) await fetch(`/api/inventory/${it.id}`, { method: 'DELETE' })
      }
      for (const r of rows) {
        if (!r.name.trim()) continue
        await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: r.name.trim(), quantityText: r.qtyText.trim() || 'あり' }),
        })
      }
      setRows([])
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 ${active ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-600'}`

  return (
    <main className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">写真で取り込み</h1>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">写真の種類</span>
        <div className="flex gap-2 text-sm">
          <button onClick={() => pickKind('receipt')} className={pill(kind === 'receipt')}>
            レシート
          </button>
          <button onClick={() => pickKind('fridge')} className={pill(kind === 'fridge')}>
            冷蔵庫
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">反映方法</span>
        <div className="flex gap-2 text-sm">
          <button onClick={() => setMode('add')} className={pill(mode === 'add')}>
            加算（在庫に足す）
          </button>
          <button onClick={() => setMode('overwrite')} className={pill(mode === 'overwrite')}>
            上書き（在庫を置き換え）
          </button>
        </div>
      </div>

      <label className="rounded border border-dashed p-4 text-center text-sm text-gray-600">
        {loading ? '処理中…' : 'タップして写真を撮る / 選ぶ'}
        <input type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
      </label>

      {error && <p className="text-sm text-red-600">エラー: {error}</p>}
      {done && <p className="text-sm text-green-700">在庫に反映しました。</p>}

      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            確認・編集（{mode === 'overwrite' ? '確定で現在の在庫を置き換え' : '確定で在庫に加算'}）
          </p>
          <ul className="flex flex-col gap-1">
            {rows.map((r, i) => (
              <li key={i} className="flex gap-2">
                <input
                  value={r.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="食材名"
                  className="flex-1 rounded border p-1"
                />
                <input
                  value={r.qtyText}
                  onChange={(e) => update(i, { qtyText: e.target.value })}
                  placeholder="個数"
                  className="w-24 rounded border p-1"
                />
                <button onClick={() => removeRow(i)} className="px-2 text-red-600" aria-label="行を削除">
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button onClick={addRow} className="rounded border px-3 py-1 text-sm">
              行を追加
            </button>
            <button
              onClick={apply}
              disabled={loading}
              className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              確定して在庫へ
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
