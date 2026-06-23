'use client'
import { useEffect, useState } from 'react'

type Kind = 'receipt' | 'fridge'
type Mode = 'add' | 'overwrite'
type Row = { name: string; qtyText: string }
type Staged = { file: File; url: string }

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
  const [staged, setStaged] = useState<Staged[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('')
  const [editing, setEditing] = useState(false)

  // アンマウント時にプレビュー用のオブジェクトURLを解放
  useEffect(() => {
    return () => staged.forEach((s) => URL.revokeObjectURL(s.url))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setDone(false)
    setStaged((prev) => [...prev, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))])
    e.target.value = ''
  }

  function removeStaged(i: number) {
    setStaged((prev) => {
      const target = prev[i]
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((_, j) => j !== i)
    })
  }

  // 溜めた写真をまとめてAIへ送り、抽出結果を下書きに反映
  async function send() {
    if (staged.length === 0 || loading) return
    setLoading(true)
    setError(null)
    setDone(false)
    try {
      const collected: Row[] = []
      for (const s of staged) {
        const image = await fileToDataUrl(s.file)
        const res = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image, kind }),
        })
        const data = await res.json()
        if (res.ok) collected.push(...(data.items ?? []))
        else setError(data.error ?? 'failed')
      }
      setRows((prev) => [...prev, ...collected])
      staged.forEach((s) => URL.revokeObjectURL(s.url))
      setStaged([])
    } finally {
      setLoading(false)
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

  async function askAi() {
    if (!instruction.trim() || editing) return
    setEditing(true)
    setError(null)
    try {
      const res = await fetch('/api/ingest/edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: rows.map((r) => ({ name: r.name, qty_text: r.qtyText })), instruction }),
      })
      const data = await res.json()
      if (res.ok) {
        setRows((data.items ?? []).map((it: { name: string; qtyText: string }) => ({ name: it.name, qtyText: it.qtyText })))
        setInstruction('')
      } else {
        setError(data.error ?? 'failed')
      }
    } finally {
      setEditing(false)
    }
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
          <button onClick={() => setKind('receipt')} className={pill(kind === 'receipt')}>
            レシート
          </button>
          <button onClick={() => setKind('fridge')} className={pill(kind === 'fridge')}>
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

      <label className="rounded border border-dashed p-3 text-center text-sm text-gray-600">
        ＋ 写真を追加（複数可）
        <input type="file" accept="image/*" multiple onChange={onAddPhotos} className="hidden" />
      </label>

      {staged.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-2">
            {staged.map((s, i) => (
              <div key={s.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="" className="h-16 w-full rounded border object-cover" />
                <button
                  onClick={() => removeStaged(i)}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black text-xs text-white"
                  aria-label="削除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={send}
            disabled={loading}
            className="self-start rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? 'AIが読み取り中…' : `送信（${staged.length}枚をAIで読み取り）`}
          </button>
        </div>
      )}

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
                  className="w-0 min-w-0 flex-1 rounded border p-1"
                />
                <input
                  value={r.qtyText}
                  onChange={(e) => update(i, { qtyText: e.target.value })}
                  placeholder="個数"
                  className="w-20 shrink-0 rounded border p-1"
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

          <div className="rounded border bg-gray-50 p-2">
            <p className="mb-1 text-xs text-gray-500">AIに修正を頼む（例: 卵を2個に、パンを削除、牛乳を追加）</p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                askAi()
              }}
              className="flex gap-2"
            >
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="修正の指示を入力"
                className="w-0 min-w-0 flex-1 rounded border p-1 text-sm"
              />
              <button
                disabled={editing}
                className="shrink-0 rounded bg-gray-800 px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                {editing ? '修正中…' : 'AIで修正'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
