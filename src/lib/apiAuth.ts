import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerSupabase } from './supabaseServer'

export type AuthedRequest = { sb: SupabaseClient; userId: string }

// API Route 用の認証ヘルパー。ログイン済みなら { sb, userId } を、
// 未ログインなら { error: 401レスポンス } を返す。
// 使い方:
//   const auth = await requireUser()
//   if ('error' in auth) return auth.error
//   const { sb, userId } = auth
export async function requireUser(): Promise<AuthedRequest | { error: NextResponse }> {
  const sb = await getServerSupabase()
  const { data } = await sb.auth.getUser()
  if (!data.user) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  return { sb, userId: data.user.id }
}
