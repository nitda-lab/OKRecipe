import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'

// マジックリンク（PKCE）の code をセッションに交換し、Cookieを確立する。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/inventory'

  if (code) {
    const supabase = await getServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  return NextResponse.redirect(`${origin}/login`)
}
