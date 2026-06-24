'use client'
import { useEffect, useState } from 'react'
import { ui } from '@/components/ui'
import { downscaleDataUrl } from '@/lib/image/downscale'

type Mode = 'add' | 'overwrite'
type Row = { name: string; qtyText: string }
type Staged = { file: File; url: string }

export function PhotoIngest() {
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
    setStaged((prev) => {
      const room = 8 - prev.length
      if (room <= 0) {
        setError('写真は一度に8枚までです')
        return prev
      }
      if (files.length > room) setError('写真は一度に8枚までです')
      return [
        ...prev,
        ...files.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) })),
      ]
    })
    e.target.value = ''
  }

  function removeStaged(i: number) {
    setStaged((prev) => {
      const target = prev[i]
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((_, j) => j !== i)
    })
  }

  // 溜めた写真を縮小して一度にAIへ送り、統合済みの抽出結果を下書きに反映
  async function send() {
    if (staged.length === 0 || loading) return
    setLoading(true)
    setError(null)
    setDone(false)
    try {
      const images = await Promise.all(staged.map((s) => downscaleDataUrl(s.file)))
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ images }),
      })
      const data = await res.json()
      if (res.ok) {
        setRows((prev) => [...prev, ...(data.items ?? [])])
        staged.forEach((s) => URL.revokeObjectURL(s.url))
        setStaged([])
      } else {
        setError(data.error ?? 'failed')
      }
    } catch (e) {
      setError((e as Error).message)
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
  function clearDraft() {
    if (rows.length > 0 && !window.confirm('下書きをすべてクリアしますか？')) return
    setRows([])
    setInstruction('')
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

  const pill = (active: boolean) => (active ? ui.chipActive : ui.chip)

  return (
    <main className="flex flex-col gap-3">
      <h1 className={ui.h1}>写真で取り込み</h1>

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

      <label className="cursor-pointer rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-center text-sm text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-50">
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
          <button onClick={send} disabled={loading} className={`${ui.btnPrimary} self-start`}>
            {loading ? 'AIが読み取り中…' : `送信（${staged.length}枚をAIで読み取り）`}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">エラー: {error}</p>}
      {done && <p className="text-sm text-green-700">在庫に反映しました。</p>}

      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-zinc-700">
            確認・編集（{mode === 'overwrite' ? '確定で現在の在庫を置き換え' : '確定で在庫に加算'}）
          </p>
          <ul className={`${ui.card} flex flex-col divide-y divide-zinc-100`}>
            {rows.map((r, i) => (
              <li key={i} className="flex gap-2 p-2">
                <input
                  value={r.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="食材名"
                  className={`${ui.input} w-0 min-w-0 flex-1`}
                />
                <input
                  value={r.qtyText}
                  onChange={(e) => update(i, { qtyText: e.target.value })}
                  placeholder="個数"
                  className={`${ui.input} w-20 shrink-0`}
                />
                <button
                  onClick={() => removeRow(i)}
                  className="flex w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label="行を削除"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button onClick={addRow} className={ui.btnSecondarySm}>
              行を追加
            </button>
            <button onClick={apply} disabled={loading} className={ui.btnPrimarySm}>
              確定して在庫へ
            </button>
            <button onClick={clearDraft} disabled={loading} className={`${ui.btnSecondarySm} ml-auto`}>
              クリア
            </button>
          </div>

          <div className={`${ui.card} p-3`}>
            <p className="mb-1.5 text-xs text-zinc-500">AIに修正を頼む（例: 卵を2個に、パンを削除、牛乳を追加）</p>
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
                className={`${ui.input} w-0 min-w-0 flex-1`}
              />
              <button disabled={editing} className={`${ui.btnSecondarySm} shrink-0`}>
                {editing ? '修正中…' : 'AIで修正'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
