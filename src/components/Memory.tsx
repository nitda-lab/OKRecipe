'use client'
import { useEffect, useState } from 'react'
import { ui } from '@/components/ui'
import { useToast } from '@/components/useToast'

type Mem = { id: string; text: string; createdAt: string }

export function Memory() {
  const [memories, setMemories] = useState<Mem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState('')
  const { show, toast } = useToast()

  async function load() {
    const res = await fetch('/api/memories')
    if (res.ok) setMemories(await res.json())
    setLoaded(true)
  }
  useEffect(() => {
    load()
  }, [])

  async function add() {
    if (!text.trim()) return
    await fetch('/api/memories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
    })
    setText('')
    load()
    show('記憶を追加しました')
  }
  async function remove(id: string) {
    await fetch(`/api/memories/${id}`, { method: 'DELETE' })
    load()
    show('記憶を削除しました')
  }

  return (
    <main className="flex flex-col gap-3">
      <h1 className={ui.h1}>メモリ</h1>
      <p className="text-sm text-zinc-500">
        AIがあなたについて覚えていること（料理・食事の好みやこだわり）。チャットで話すと自動で増えます。不要なものは削除できます。
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="手動で追加（例: 揚げ物は面倒）"
          className={`${ui.input} w-0 min-w-0 flex-1`}
        />
        <button className={`${ui.btnPrimary} shrink-0`}>追加</button>
      </form>

      {!loaded ? (
        <p className="py-10 text-center text-sm text-zinc-400">読み込み中…</p>
      ) : memories.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-400">
          まだ記憶はありません。チャットで好みやこだわりを話すと自動で覚えます。
        </p>
      ) : (
        <ul className={`${ui.card} divide-y divide-zinc-100`}>
          {memories.map((m) => (
            <li key={m.id} className="flex items-center gap-2 px-3 py-2.5">
              <span className="flex-1 text-sm text-zinc-800">{m.text}</span>
              <button
                onClick={() => remove(m.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label="削除"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {toast}
    </main>
  )
}
