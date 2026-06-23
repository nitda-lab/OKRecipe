import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { createDraftEditorFromEnv } from '@/lib/ai/draftEdit'
import type { ExtractedItem } from '@/lib/ai/vision'

export async function POST(req: Request) {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const items = Array.isArray(body?.items) ? (body.items as ExtractedItem[]) : null
  const instruction = typeof body?.instruction === 'string' ? body.instruction : null
  if (!items || !instruction) {
    return NextResponse.json({ error: 'items and instruction required' }, { status: 400 })
  }

  try {
    const edited = await createDraftEditorFromEnv().edit(items, instruction)
    return NextResponse.json({ items: edited })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
