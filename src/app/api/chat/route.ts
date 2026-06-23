import { getServerSupabase } from '@/lib/supabaseServer'
import { SupabaseInventoryRepository } from '@/repositories/supabaseInventoryRepository'
import { SupabaseConversationRepository } from '@/repositories/supabaseConversationRepository'
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

  const lastUser = [...history].reverse().find((m) => m.role === 'user')
  const incomingConversationId: string | null =
    typeof body?.conversationId === 'string' ? body.conversationId : null

  const inventoryRepo = new SupabaseInventoryRepository(sb)
  const convoRepo = new SupabaseConversationRepository(sb)
  const provider = createNanoGptProviderFromEnv()
  const userId = auth.user.id

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      try {
        const out = await runChatAgentStream({ provider, repo: inventoryRepo, userId }, history, {
          onToken: (text) => send({ type: 'token', text }),
          onStatus: (status) => send({ type: 'status', status }),
        })

        // 会話を永続化（ストリーム完了後にまとめて）。失敗してもチャット自体は壊さない。
        let conversationId = incomingConversationId
        try {
          if (!conversationId) {
            const title = (lastUser?.content ?? '新しい会話').slice(0, 30)
            conversationId = await convoRepo.create(userId, title)
          }
          const toSave = [
            ...(lastUser ? [{ role: 'user' as const, content: lastUser.content }] : []),
            { role: 'assistant' as const, content: out.reply },
          ]
          await convoRepo.appendMessages(userId, conversationId, toSave)
        } catch {
          // 永続化失敗は握りつぶす（履歴が残らないだけ）
        }

        send({ type: 'done', reply: out.reply, pending: out.pending, conversationId })
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
