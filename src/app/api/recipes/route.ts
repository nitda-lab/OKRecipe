import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'
import { SupabaseRecipeRepository } from '@/repositories/supabaseRecipeRepository'

export async function GET() {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  return NextResponse.json(await new SupabaseRecipeRepository(auth.sb).list(auth.userId))
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const body = await req.json()
  if (!body?.title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const rec = await new SupabaseRecipeRepository(auth.sb).create(auth.userId, {
    title: body.title,
    body: body.body ?? '',
  })
  return NextResponse.json(rec, { status: 201 })
}
