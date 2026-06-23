'use client'
import { useCallback, useRef, useState } from 'react'

// 画面下に数秒だけ出る簡易通知。show(message) で表示、toast を JSX に置く。
export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((m: string) => {
    setMessage(m)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), 2500)
  }, [])

  const toast = message ? (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/85 px-4 py-2 text-sm text-white shadow-lg">
      {message}
    </div>
  ) : null

  return { show, toast }
}
