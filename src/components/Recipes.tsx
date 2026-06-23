'use client'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { normalizeMarkdown } from '@/lib/markdown'
import { useToast } from '@/components/useToast'

type Recipe = { id: string; title: string; body: string; createdAt: string }

const MD_CLASS =
  'text-sm [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-bold [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-semibold [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-200 [&_th]:px-2 [&_th]:py-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5'

export function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [open, setOpen] = useState<Recipe | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const { show, toast } = useToast()

  async function load() {
    const res = await fetch('/api/recipes')
    if (res.ok) setRecipes(await res.json())
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
        <button onClick={() => setOpen(null)} className="self-start text-sm text-blue-600">
          ← 一覧へ
        </button>
        <h1 className="text-lg font-bold">{open.title}</h1>
        <div className={MD_CLASS}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizeMarkdown(open.body)}</ReactMarkdown>
        </div>
        <button onClick={() => remove(open.id)} className="self-start text-sm text-red-600">
          このレシピを削除
        </button>
        {toast}
      </main>
    )
  }

  return (
    <main className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">レシピ</h1>

      <details className="rounded border p-2">
        <summary className="cursor-pointer text-sm">手動で追加</summary>
        <div className="mt-2 flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="レシピ名"
            className="rounded border p-2"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="本文（Markdown）"
            rows={5}
            className="rounded border p-2"
          />
          <button onClick={add} className="self-start rounded bg-black px-3 py-1 text-sm text-white">
            追加
          </button>
        </div>
      </details>

      {recipes.length === 0 ? (
        <p className="py-8 text-center text-gray-500">
          保存済みレシピはありません。チャットで「このレシピ保存して」と頼めます。
        </p>
      ) : (
        <ul className="divide-y">
          {recipes.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-3">
              <button onClick={() => setOpen(r)} className="flex-1 text-left font-medium">
                {r.title}
              </button>
              <button onClick={() => remove(r.id)} className="px-2 text-red-600" aria-label="削除">
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
