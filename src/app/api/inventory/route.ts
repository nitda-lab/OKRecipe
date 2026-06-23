import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { SupabaseInventoryRepository } from '@/repositories/supabaseInventoryRepository'

export async function GET() {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const repo = new SupabaseInventoryRepository(sb)
  return NextResponse.json(await repo.list(auth.user.id))
}

export async function POST(req: Request) {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body?.name || !body?.quantityText) {
    return NextResponse.json({ error: 'name and quantityText required' }, { status: 400 })
  }
  const repo = new SupabaseInventoryRepository(sb)
  const item = await repo.add(auth.user.id, { name: body.name, quantityText: body.quantityText })
  return NextResponse.json(item, { status: 201 })
}
