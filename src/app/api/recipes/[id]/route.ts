import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { SupabaseRecipeRepository } from '@/repositories/supabaseRecipeRepository'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rec = await new SupabaseRecipeRepository(sb).get(auth.user.id, id)
  if (!rec) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(rec)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  await new SupabaseRecipeRepository(sb).remove(auth.user.id, id)
  return new NextResponse(null, { status: 204 })
}
