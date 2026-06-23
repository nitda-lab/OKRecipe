import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { SupabaseRecipeRepository } from '@/repositories/supabaseRecipeRepository'

export async function GET() {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await new SupabaseRecipeRepository(sb).list(auth.user.id))
}

export async function POST(req: Request) {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body?.title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const rec = await new SupabaseRecipeRepository(sb).create(auth.user.id, {
    title: body.title,
    body: body.body ?? '',
  })
  return NextResponse.json(rec, { status: 201 })
}
