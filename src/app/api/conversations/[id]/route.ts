import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'
import { SupabaseConversationRepository } from '@/repositories/supabaseConversationRepository'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  return NextResponse.json(await new SupabaseConversationRepository(auth.sb).getMessages(auth.userId, id))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  await new SupabaseConversationRepository(auth.sb).remove(auth.userId, id)
  return new NextResponse(null, { status: 204 })
}
