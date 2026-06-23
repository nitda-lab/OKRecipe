import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { createVisionExtractorFromEnv } from '@/lib/ai/vision'
import { SupabaseIngestLogRepository } from '@/repositories/ingestLogRepository'

export async function POST(req: Request) {
  const sb = await getServerSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const image = typeof body?.image === 'string' ? body.image : null
  const kind = body?.kind === 'receipt' || body?.kind === 'fridge' ? body.kind : null
  if (!image || !kind) {
    return NextResponse.json(
      { error: 'image(dataURL) and kind(receipt|fridge) required' },
      { status: 400 },
    )
  }

  const extractor = createVisionExtractorFromEnv()
  try {
    const items = await extractor.extract(image, kind)
    try {
      await new SupabaseIngestLogRepository(sb).record(auth.user.id, kind, JSON.stringify(items))
    } catch {
      // ログ失敗は握りつぶす（抽出結果は返す）
    }
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
