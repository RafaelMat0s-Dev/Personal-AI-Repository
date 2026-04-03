import { createClient } from '@/lib/supabase/server'
import HabitTracker from '@/components/habits/HabitTracker'
import { format } from 'date-fns'

export default async function HabitsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
  const monthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd')

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from('habits').select('*').eq('user_id', user.id).order('position'),
    supabase.from('habit_logs').select('*').eq('user_id', user.id).gte('date', monthStart).lte('date', monthEnd),
  ])

  return <HabitTracker initialHabits={habits || []} initialLogs={logs || []} userId={user.id} />
}
