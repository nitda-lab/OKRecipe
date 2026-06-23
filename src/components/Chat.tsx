'use client'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { PendingAction } from '@/lib/ai/inventoryTools'

type Msg = { role: 'user' | 'assistant'; content: string }
type ConversationSummary = { id: string; title: string; updatedAt: string }

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
  const [status, setStatus] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [showHistory, setShowHistory] = useState(false)

  async function loadConversations() {
    const res = await fetch('/api/conversations')
    if (res.ok) setConversations(await res.json())
  }
  useEffect(() => {
    loadConversations()
  }, [])

  function newConversation() {
    setConversationId(null)
    setMessages([])
    setPending([])
    setShowHistory(false)
  }

  async function openConversation(id: string) {
    const res = await fetch(`/api/conversations/${id}`)
    if (res.ok) {
      setMessages(await res.json())
      setConversationId(id)
      setPending([])
      setShowHistory(false)
    }
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    if (id === conversationId) newConversation()
    loadConversations()
  }

  async function send(text: string) {
    if (!text.trim() || loading) return
    const next = [...messages, { role: 'user' as const, content: text.trim() }]
    setMessages([...next, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)
    setStatus(null)

    let assistant = ''
    const render = () => setMessages([...next, { role: 'assistant', content: assistant }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next, conversationId }),
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        assistant = `エラー: ${data.error}`
        render()
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (!line) continue
          const ev = JSON.parse(line)
          if (ev.type === 'token') {
            assistant += ev.text
            setStatus(null)
            render()
          } else if (ev.type === 'status') {
            setStatus(ev.status)
          } else if (ev.type === 'done') {
            if (!assistant) assistant = ev.reply
            render()
            setPending(ev.pending ?? [])
            if (ev.conversationId) setConversationId(ev.conversationId)
            loadConversations()
          } else if (ev.type === 'error') {
            assistant = `エラー: ${ev.error}`
            render()
          }
        }
      }
    } finally {
      setLoading(false)
      setStatus(null)
    }
  }

  async function confirm(action: PendingAction) {
    if (action.type === 'save_recipe') {
      await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: action.title, body: action.body }),
      })
      setPending((p) => p.filter((a) => a !== action))
      return
    }
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
    if (a.type === 'save_recipe') return `レシピ保存: ${a.title}`
    return `削除: id ${a.id}`
  }

  return (
    <main className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">チャット</h1>
        <div className="flex gap-2 text-xs">
          <button onClick={() => setShowHistory((v) => !v)} className="rounded border px-2 py-1">
            履歴
          </button>
          <button onClick={newConversation} className="rounded border px-2 py-1">
            新規会話
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="rounded border bg-white p-2">
          <p className="mb-1 text-xs font-medium text-gray-500">過去の会話</p>
          {conversations.length === 0 ? (
            <p className="text-xs text-gray-400">まだ会話がありません。</p>
          ) : (
            <ul className="flex flex-col">
              {conversations.map((c) => (
                <li key={c.id} className="flex items-center gap-2 border-b py-1 last:border-0">
                  <button
                    onClick={() => openConversation(c.id)}
                    className={`flex-1 truncate text-left text-sm ${c.id === conversationId ? 'font-bold' : ''}`}
                  >
                    {c.title}
                  </button>
                  <button
                    onClick={() => deleteConversation(c.id)}
                    className="px-1 text-xs text-red-600"
                    aria-label="会話を削除"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button key={q} onClick={() => send(q)} className="rounded-full border px-3 py-1 text-xs">
            {q}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <li key={i} className="max-w-[85%] self-end rounded bg-blue-100 p-2">
              {m.content}
            </li>
          ) : (
            <li
              key={i}
              className="max-w-full self-start overflow-x-auto rounded bg-gray-100 p-2 text-sm [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-bold [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-semibold [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-200 [&_th]:px-2 [&_th]:py-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
            </li>
          ),
        )}
        {status && <li className="self-start text-sm text-gray-400">{status}</li>}
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
