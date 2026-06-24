import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'
import { SupabaseMemoryRepository } from '@/repositories/supabaseMemoryRepository'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  await new SupabaseMemoryRepository(auth.sb).remove(auth.userId, id)
  return new NextResponse(null, { status: 204 })
}
