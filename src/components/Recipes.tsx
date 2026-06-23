'use client'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { normalizeMarkdown } from '@/lib/markdown'
import { useToast } from '@/components/useToast'
import { MARKDOWN_TYPO } from '@/components/markdownStyles'
import { ui } from '@/components/ui'

type Recipe = { id: string; title: string; body: string; createdAt: string }

const MD_CLASS = `text-sm ${MARKDOWN_TYPO}`

export function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [open, setOpen] = useState<Recipe | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loaded, setLoaded] = useState(false)
  const { show, toast } = useToast()

  async function load() {
    const res = await fetch('/api/recipes')
    if (res.ok) setRecipes(await res.json())
    setLoaded(true)
  }
  useEffect(() => {
    load()
  }, [])

  async function add() {
    if (!title.trim()) return
    await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), body }),
    })
    setTitle('')
    setBody('')
    load()
    show('レシピを保存しました')
  }
  async function remove(id: string) {
    await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
    if (open?.id === id) setOpen(null)
    load()
    show('レシピを削除しました')
  }

  if (open) {
    return (
      <main className="flex flex-col gap-3">
        <button onClick={() => setOpen(null)} className="self-start text-sm text-zinc-500 hover:text-zinc-900">
          ← 一覧へ
        </button>
        <h1 className={ui.h1}>{open.title}</h1>
        <div className={`${ui.card} ${MD_CLASS} p-4`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizeMarkdown(open.body)}</ReactMarkdown>
        </div>
        <button onClick={() => remove(open.id)} className="self-start text-sm text-zinc-400 hover:text-red-600">
          このレシピを削除
        </button>
        {toast}
      </main>
    )
  }

  return (
    <main className="flex flex-col gap-3">
      <h1 className={ui.h1}>レシピ</h1>

      <details className={`${ui.card} p-3`}>
        <summary className="cursor-pointer text-sm text-zinc-600">手動で追加</summary>
        <div className="mt-2 flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="レシピ名"
            className={ui.input}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="本文（Markdown）"
            rows={5}
            className={ui.input}
          />
          <button onClick={add} className={`${ui.btnPrimarySm} self-start`}>
            追加
          </button>
        </div>
      </details>

      {!loaded ? (
        <p className="py-10 text-center text-sm text-zinc-400">読み込み中…</p>
      ) : recipes.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-400">
          保存済みレシピはありません。チャットで「このレシピ保存して」と頼めます。
        </p>
      ) : (
        <ul className={`${ui.card} divide-y divide-zinc-100`}>
          {recipes.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2.5">
              <button onClick={() => setOpen(r)} className="flex-1 truncate text-left text-sm font-medium text-zinc-800">
                {r.title}
              </button>
              <button
                onClick={() => remove(r.id)}
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
