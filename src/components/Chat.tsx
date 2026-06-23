'use client'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { PendingAction } from '@/lib/ai/inventoryTools'
import { normalizeMarkdown } from '@/lib/markdown'
import { useToast } from '@/components/useToast'
import { MARKDOWN_TYPO } from '@/components/markdownStyles'
import { ui } from '@/components/ui'

type Msg = { role: 'user' | 'assistant'; content: string }
type ConversationSummary = { id: string; title: string; updatedAt: string }

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

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
  const { show, toast } = useToast()

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
      show(`レシピ「${action.title}」を保存しました`)
      return
    }
    if (action.type === 'add') {
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: action.name, quantityText: action.quantityText }),
      })
      show('在庫に追加しました')
    } else if (action.type === 'update') {
      await fetch(`/api/inventory/${action.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantityText: action.quantityText }),
      })
      show('在庫を更新しました')
    } else {
      await fetch(`/api/inventory/${action.id}`, { method: 'DELETE' })
      show('在庫から削除しました')
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
        <h1 className={ui.h1}>チャット</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHistory((v) => !v)} className={ui.btnSecondarySm}>
            履歴
          </button>
          <button onClick={newConversation} className={ui.btnSecondarySm}>
            新規会話
          </button>
        </div>
      </div>

      {showHistory && (
        <div className={`${ui.card} p-3`}>
          <p className="mb-1 text-xs font-medium text-zinc-500">過去の会話</p>
          {conversations.length === 0 ? (
            <p className="text-xs text-zinc-400">まだ会話がありません。</p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100">
              {conversations.map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-1.5">
                  <button onClick={() => openConversation(c.id)} className="min-w-0 flex-1 text-left">
                    <span
                      className={`block truncate text-sm ${c.id === conversationId ? 'font-semibold text-zinc-900' : 'text-zinc-700'}`}
                    >
                      {c.title}
                    </span>
                    <span className="block text-xs text-zinc-400">{formatDateTime(c.updatedAt)}</span>
                  </button>
                  <button
                    onClick={() => deleteConversation(c.id)}
                    className="px-1 text-xs text-zinc-400 transition-colors hover:text-red-600"
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
          <button key={q} onClick={() => send(q)} className={ui.chip}>
            {q}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2.5">
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <li key={i} className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-zinc-900 px-3.5 py-2 text-sm text-white">
              {m.content}
            </li>
          ) : (
            <li
              key={i}
              className={`max-w-full self-start overflow-x-auto rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-800 shadow-sm ${MARKDOWN_TYPO}`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizeMarkdown(m.content)}</ReactMarkdown>
            </li>
          ),
        )}
        {status && <li className="self-start text-sm text-zinc-400">{status}</li>}
      </ul>

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-1.5 text-sm font-medium text-amber-900">確認してください</p>
          <ul className="flex flex-col gap-1.5">
            {pending.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm text-zinc-700">
                <span className="truncate">{label(a)}</span>
                <button onClick={() => confirm(a)} className={`${ui.btnPrimarySm} shrink-0`}>
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
        className="sticky bottom-0 mt-2 flex gap-2 bg-zinc-50 py-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力"
          className={`${ui.input} flex-1`}
        />
        <button className={`${ui.btnPrimary} shrink-0`} disabled={loading}>
          送信
        </button>
      </form>
      {toast}
    </main>
  )
}
