import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { SupabaseConversationRepository } from '@/repositories/supabaseConversationRepository'

export async function GET() {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const repo = new SupabaseConversationRepository(sb)
  return NextResponse.json(await repo.list(auth.user.id))
}
