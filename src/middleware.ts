import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Supabase のセッションCookieをリクエスト/レスポンス間で同期・更新する。
// これが無いと、ブラウザでログインしてもサーバーコンポーネントがセッションを
// 認識できず、保護ページにアクセスしてもログイン画面に戻されてしまう。
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // セッションを更新（必要ならトークンをリフレッシュしてCookieに反映）
  await supabase.auth.getUser()

  return response
}

export const config = {
  // 静的アセットと認証関連ページ以外で実行
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
