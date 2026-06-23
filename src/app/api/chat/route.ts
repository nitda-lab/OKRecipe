import { getServerSupabase } from '@/lib/supabaseServer'
import { SupabaseInventoryRepository } from '@/repositories/supabaseInventoryRepository'
import { createNanoGptProviderFromEnv } from '@/lib/ai/provider'
import { runChatAgentStream } from '@/lib/ai/chatAgent'
import type { ChatMessage } from '@/lib/ai/types'

export async function POST(req: Request) {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const incoming = Array.isArray(body?.messages) ? body.messages : null
  if (!incoming) return Response.json({ error: 'messages required' }, { status: 400 })

  const history: ChatMessage[] = incoming
    .filter((m: { role: string; content: string }) => m.role === 'user' || m.role === 'assistant')
    .map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content }))

  const repo = new SupabaseInventoryRepository(sb)
  const provider = createNanoGptProviderFromEnv()
  const userId = auth.user.id

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      try {
        const out = await runChatAgentStream({ provider, repo, userId }, history, {
          onToken: (text) => send({ type: 'token', text }),
          onStatus: (status) => send({ type: 'status', status }),
        })
        send({ type: 'done', reply: out.reply, pending: out.pending })
      } catch (e) {
        send({ type: 'error', error: (e as Error).message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  })
}
