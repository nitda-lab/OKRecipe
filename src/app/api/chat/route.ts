import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { SupabaseInventoryRepository } from '@/repositories/supabaseInventoryRepository'
import { createNanoGptProviderFromEnv } from '@/lib/ai/provider'
import { runChatAgent } from '@/lib/ai/chatAgent'
import type { ChatMessage } from '@/lib/ai/types'

export async function POST(req: Request) {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const incoming = Array.isArray(body?.messages) ? body.messages : null
  if (!incoming) return NextResponse.json({ error: 'messages required' }, { status: 400 })

  const history: ChatMessage[] = incoming
    .filter((m: { role: string; content: string }) => m.role === 'user' || m.role === 'assistant')
    .map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content }))

  const repo = new SupabaseInventoryRepository(sb)
  const provider = createNanoGptProviderFromEnv()
  try {
    const out = await runChatAgent({ provider, repo, userId: auth.user.id }, history)
    return NextResponse.json(out)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
