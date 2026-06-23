import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'
import { SupabaseConversationRepository } from '@/repositories/supabaseConversationRepository'

export async function GET() {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  return NextResponse.json(await new SupabaseConversationRepository(auth.sb).list(auth.userId))
}
