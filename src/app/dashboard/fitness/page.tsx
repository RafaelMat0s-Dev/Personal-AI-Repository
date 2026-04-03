import { createClient } from '@/lib/supabase/server'
import FitnessClient from '@/components/fitness/FitnessClient'
import { format } from 'date-fns'

export default async function FitnessPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = format(new Date(), 'yyyy-MM-dd')

  const [
    { data: goals },
    { data: foodLogs },
    { data: workoutPlans },
    { data: workoutLogs },
  ] = await Promise.all([
    supabase.from('nutrition_goals').select('*').eq('user_id', user.id).single(),
    supabase.from('food_logs').select('*').eq('user_id', user.id).eq('date', today).order('created_at'),
    supabase.from('workout_plans').select('*').eq('user_id', user.id).order('day_of_week').order('position'),
    supabase.from('workout_logs').select('*').eq('user_id', user.id).gte('date', today),
  ])

  return (
    <FitnessClient
      userId={user.id}
      initialGoals={goals || { calories: 2000, protein: 150, carbs: 250, fat: 65 }}
      initialFoodLogs={foodLogs || []}
      initialWorkoutPlans={workoutPlans || []}
      initialWorkoutLogs={workoutLogs || []}
      today={today}
    />
  )
}
