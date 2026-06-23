'use client'
import { useState } from 'react'
import type { PendingAction } from '@/lib/ai/inventoryTools'

type Msg = { role: 'user' | 'assistant'; content: string }

const QUICK = [
  'ありもので作れるレシピを教えて',
  '今週の献立を組んで（使い切り重視）',
  '賞味期限が近いものを優先して使うレシピは？',
]

export function Chat() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(false)

  async function send(text: string) {
    if (!text.trim() || loading) return
    const next = [...messages, { role: 'user' as const, content: text.trim() }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages([...next, { role: 'assistant', content: data.reply }])
        setPending(data.pending ?? [])
      } else {
        setMessages([...next, { role: 'assistant', content: `エラー: ${data.error}` }])
      }
    } finally {
      setLoading(false)
    }
  }

  async function confirm(action: PendingAction) {
    if (action.type === 'add') {
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: action.name, quantityText: action.quantityText }),
      })
    } else if (action.type === 'update') {
      await fetch(`/api/inventory/${action.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantityText: action.quantityText }),
      })
    } else {
      await fetch(`/api/inventory/${action.id}`, { method: 'DELETE' })
    }
    setPending((p) => p.filter((a) => a !== action))
  }

  function label(a: PendingAction) {
    if (a.type === 'add') return `追加: ${a.name} ${a.quantityText}`
    if (a.type === 'update') return `個数変更: ${a.quantityText}（id ${a.id}）`
    return `削除: id ${a.id}`
  }

  return (
    <main className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">チャット</h1>

      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button key={q} onClick={() => send(q)} className="rounded-full border px-3 py-1 text-xs">
            {q}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {messages.map((m, i) => (
          <li
            key={i}
            className={m.role === 'user' ? 'self-end rounded bg-blue-100 p-2' : 'self-start rounded bg-gray-100 p-2'}
          >
            {m.content}
          </li>
        ))}
        {loading && <li className="self-start text-gray-400">考え中…</li>}
      </ul>

      {pending.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-2">
          <p className="mb-1 text-sm font-medium">在庫への提案（確認してください）</p>
          <ul className="flex flex-col gap-1">
            {pending.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm">
                <span>{label(a)}</span>
                <button onClick={() => confirm(a)} className="rounded bg-black px-2 py-1 text-xs text-white">
                  反映
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力"
          className="flex-1 rounded border p-2"
        />
        <button className="rounded bg-black px-3 text-white" disabled={loading}>
          送信
        </button>
      </form>
    </main>
  )
}
