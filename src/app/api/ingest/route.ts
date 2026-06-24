import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'
import { createVisionExtractorFromEnv } from '@/lib/ai/vision'
import { SupabaseIngestLogRepository } from '@/repositories/ingestLogRepository'

export async function POST(req: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error

  const body = await req.json()
  const images =
    Array.isArray(body?.images) && body.images.every((x: unknown) => typeof x === 'string')
      ? (body.images as string[])
      : null
  if (!images || images.length === 0) {
    return NextResponse.json(
      { error: 'images (non-empty array of data URLs) required' },
      { status: 400 },
    )
  }

  const extractor = createVisionExtractorFromEnv()
  try {
    const { kind, items } = await extractor.extract(images)
    try {
      await new SupabaseIngestLogRepository(auth.sb).record(auth.userId, kind, JSON.stringify(items))
    } catch {
      // ログ失敗は握りつぶす（抽出結果は返す）
    }
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
