import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'
import { SupabaseInventoryRepository } from '@/repositories/supabaseInventoryRepository'

export async function GET() {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const repo = new SupabaseInventoryRepository(auth.sb)
  return NextResponse.json(await repo.list(auth.userId))
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const body = await req.json()
  if (!body?.name || !body?.quantityText) {
    return NextResponse.json({ error: 'name and quantityText required' }, { status: 400 })
  }
  const repo = new SupabaseInventoryRepository(auth.sb)
  const item = await repo.add(auth.userId, { name: body.name, quantityText: body.quantityText })
  return NextResponse.json(item, { status: 201 })
}
