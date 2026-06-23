import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'
import { SupabaseInventoryRepository } from '@/repositories/supabaseInventoryRepository'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const body = await req.json()
  if (!body?.quantityText) {
    return NextResponse.json({ error: 'quantityText required' }, { status: 400 })
  }
  const repo = new SupabaseInventoryRepository(auth.sb)
  return NextResponse.json(await repo.updateQuantity(auth.userId, id, body.quantityText))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const repo = new SupabaseInventoryRepository(auth.sb)
  await repo.remove(auth.userId, id)
  return new NextResponse(null, { status: 204 })
}
