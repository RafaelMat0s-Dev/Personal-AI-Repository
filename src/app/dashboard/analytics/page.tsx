import { createClient } from '@/lib/supabase/server'
import AnalyticsClient from '@/components/analytics/AnalyticsClient'
import { format, subDays } from 'date-fns'

export default async function AnalyticsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date()
  const thirtyDaysAgo = format(subDays(today, 29), 'yyyy-MM-dd')
  const todayStr = format(today, 'yyyy-MM-dd')

  const [
    { data: tasks },
    { data: habits },
    { data: habitLogs },
    { data: foodLogs },
    { data: workoutLogs },
    { data: workoutPlans },
  ] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', user.id),
    supabase.from('habits').select('id,name').eq('user_id', user.id),
    supabase.from('habit_logs').select('*').eq('user_id', user.id).gte('date', thirtyDaysAgo),
    supabase.from('food_logs').select('date,calories,protein').eq('user_id', user.id).gte('date', thirtyDaysAgo),
    supabase.from('workout_logs').select('*').eq('user_id', user.id).gte('date', thirtyDaysAgo),
    supabase.from('workout_plans').select('id').eq('user_id', user.id),
  ])

  return (
    <AnalyticsClient
      tasks={tasks || []}
      habits={habits || []}
      habitLogs={habitLogs || []}
      foodLogs={foodLogs || []}
      workoutLogs={workoutLogs || []}
      workoutPlanCount={workoutPlans?.length || 0}
      thirtyDaysAgo={thirtyDaysAgo}
      today={todayStr}
    />
  )
}
