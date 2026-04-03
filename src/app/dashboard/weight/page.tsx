import { createClient } from '@/lib/supabase/server'
import WeightClient from '@/components/weight/WeightClient'

export default async function WeightPage() {

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: logs } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: true })

  return <WeightClient initialLogs={logs || []} userId={user.id} />
}
