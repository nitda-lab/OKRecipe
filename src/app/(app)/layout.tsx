import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabaseServer'
import { NavBar } from '@/components/NavBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getServerSupabase()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return (
    <div>
      <NavBar email={data.user.email} />
      <div className="mx-auto max-w-md p-4 pt-3">{children}</div>
    </div>
  )
}
