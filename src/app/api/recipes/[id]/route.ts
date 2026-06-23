import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'
import { SupabaseRecipeRepository } from '@/repositories/supabaseRecipeRepository'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const rec = await new SupabaseRecipeRepository(auth.sb).get(auth.userId, id)
  if (!rec) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(rec)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  await new SupabaseRecipeRepository(auth.sb).remove(auth.userId, id)
  return new NextResponse(null, { status: 204 })
}
