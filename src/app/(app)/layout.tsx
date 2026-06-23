import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabaseServer'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getServerSupabase()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <div className="mx-auto max-w-md p-4">{children}</div>
}
