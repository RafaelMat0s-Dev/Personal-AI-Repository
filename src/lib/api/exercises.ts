import { ExerciseResult } from '@/types'

export async function searchExercises(
  query: string,
  muscle?: string
): Promise<ExerciseResult[]> {
  try {
    const params = new URLSearchParams()
    if (query) params.set('name', query)
    if (muscle) params.set('muscle', muscle)

    const res = await fetch(`/api/exercise-search?${params.toString()}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data || []).slice(0, 10) as ExerciseResult[]
  } catch (err) {
    console.error('Exercise search error:', err)
    return []
  }
}

export const MUSCLE_GROUPS = [
  'abdominals', 'abductors', 'adductors', 'biceps', 'calves',
  'chest', 'forearms', 'glutes', 'hamstrings', 'lats',
  'lower_back', 'middle_back', 'neck', 'quadriceps', 'traps', 'triceps'
]

export const MUSCLE_ICONS: Record<string, string> = {
  chest: '💪', biceps: '💪', triceps: '💪', forearms: '💪',
  lats: '🏋️', middle_back: '🏋️', lower_back: '🏋️', traps: '🏋️',
  abdominals: '🔥', abductors: '🦵', adductors: '🦵',
  quadriceps: '🦵', hamstrings: '🦵', glutes: '🍑', calves: '🦶',
  neck: '🧠',
}
