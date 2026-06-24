import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'
import { SupabaseMemoryRepository } from '@/repositories/supabaseMemoryRepository'

export async function GET() {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  return NextResponse.json(await new SupabaseMemoryRepository(auth.sb).list(auth.userId))
}

export async function POST(req: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const body = await req.json()
  if (!body?.text || typeof body.text !== 'string') {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }
  const mem = await new SupabaseMemoryRepository(auth.sb).create(auth.userId, body.text)
  return NextResponse.json(mem, { status: 201 })
}
