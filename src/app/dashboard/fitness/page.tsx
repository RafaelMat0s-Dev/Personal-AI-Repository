import { createClient } from '@/lib/supabase/server'
import FitnessClient from '@/components/fitness/FitnessClient'
import { format } from 'date-fns'

export default async function FitnessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = format(new Date(), 'yyyy-MM-dd')

  const [{ data: goals }, { data: foodLogs }] = await Promise.all([
    supabase.from('nutrition_goals').select('*').eq('user_id', user.id).single(),
    supabase.from('food_logs').select('*').eq('user_id', user.id).eq('date', today).order('created_at'),
  ])

  return (
    <FitnessClient
      userId={user.id}
      initialGoals={goals || { calories: 2000, protein: 150, carbs: 250, fat: 65 }}
      initialFoodLogs={foodLogs || []}
      today={today}
    />
  )
}
