import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { SupabaseConversationRepository } from '@/repositories/supabaseConversationRepository'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const repo = new SupabaseConversationRepository(sb)
  return NextResponse.json(await repo.getMessages(auth.user.id, id))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const repo = new SupabaseConversationRepository(sb)
  await repo.remove(auth.user.id, id)
  return new NextResponse(null, { status: 204 })
}
