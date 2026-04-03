'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FoodLog, WorkoutPlan, WorkoutLog, NutritionGoals, MealType, DayOfWeek, FoodSearchResult, ExerciseResult } from '@/types'
import { DAYS_OF_WEEK } from '@/lib/utils'
import { Button, Modal, Input, Select, Card, CardHeader, CardBody } from '@/components/ui'
import { searchFood, calcNutrition } from '@/lib/api/food'
import { searchExercises, MUSCLE_GROUPS, MUSCLE_ICONS } from '@/lib/api/exercises'
import { Plus, Search, Loader2, Trash2, CheckCircle, Circle, Settings, Trophy, ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from 'recharts'
import toast from 'react-hot-toast'

const MEALS: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
const SET_TYPES = [
  { value: 'working', label: 'Working', color: '#c8fa5f' },
  { value: 'warmup', label: 'Warm-up', color: '#fac86c' },
  { value: 'dropset', label: 'Drop Set', color: '#fa6c6c' },
]

// ── Types ────────────────────────────────────────────────────
interface CustomFood {
  id: string; user_id: string; name: string
  calories_100g: number; protein_100g: number; carbs_100g: number; fat_100g: number
}
interface WorkoutSession {
  id: string; user_id: string; date: string; name: string; notes?: string
}
interface SessionExercise {
  id: string; session_id: string; exercise_name: string
  muscle_group?: string; is_cardio: boolean; position: number
}
interface ExerciseSet {
  id: string; session_exercise_id: string; set_number: number
  set_type: 'working' | 'warmup' | 'dropset'
  weight_kg?: number; reps?: number
  duration_minutes?: number; distance_km?: number; completed: boolean
}

const TOOLTIP_STYLE = {
  contentStyle: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: 'var(--text)' },
  labelStyle: { color: 'var(--text-muted)', fontSize: '10px' },
}

export default function FitnessClient({ userId, initialGoals, initialFoodLogs, initialWorkoutPlans, initialWorkoutLogs, today }: {
  userId: string; initialGoals: NutritionGoals; initialFoodLogs: FoodLog[]
  initialWorkoutPlans: WorkoutPlan[]; initialWorkoutLogs: WorkoutLog[]; today: string
}) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'nutrition' | 'workout'>('nutrition')

  // ── Nutrition state ──────────────────────────────────────
  const [goals, setGoals] = useState<NutritionGoals>(initialGoals)
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>(initialFoodLogs)
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([])
  const [nutritionHistory, setNutritionHistory] = useState<{ date: string; calories: number; protein: number; carbs: number; fat: number }[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // Food modal state
  const [foodModal, setFoodModal] = useState(false)
  const [foodMeal, setFoodMeal] = useState<MealType>('Breakfast')
  const [foodTab, setFoodTab] = useState<'search' | 'custom' | 'library'>('search')
  const [foodQuery, setFoodQuery] = useState('')
  const [foodResults, setFoodResults] = useState<FoodSearchResult[]>([])
  const [foodLoading, setFoodLoading] = useState(false)
  const [foodSearchError, setFoodSearchError] = useState(false)
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null)
  const [selectedCustomFood, setSelectedCustomFood] = useState<CustomFood | null>(null)
  const [grams, setGrams] = useState('100')
  const [customLibraryLoaded, setCustomLibraryLoaded] = useState(false)

  // Custom food creation
  const [newCustomFood, setNewCustomFood] = useState({ name: '', calories_100g: '', protein_100g: '', carbs_100g: '', fat_100g: '' })
  const [goalsModal, setGoalsModal] = useState(false)
  const [goalsForm, setGoalsForm] = useState<NutritionGoals>(goals)
  const [showNutritionCharts, setShowNutritionCharts] = useState(false)

  // ── Workout state ────────────────────────────────────────
  const [activeDay, setActiveDay] = useState<DayOfWeek>(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return (days[new Date().getDay()] as DayOfWeek) || 'Mon'
  })
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>([])
  const [exerciseSets, setExerciseSets] = useState<ExerciseSet[]>([])
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null)
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [workoutLoaded, setWorkoutLoaded] = useState(false)

  // Workout modals
  const [sessionModal, setSessionModal] = useState(false)
  const [sessionForm, setSessionForm] = useState({ name: 'Workout', notes: '' })
  const [exModal, setExModal] = useState(false)
  const [exQuery, setExQuery] = useState('')
  const [exMuscle, setExMuscle] = useState('')
  const [exResults, setExResults] = useState<ExerciseResult[]>([])
  const [exLoading, setExLoading] = useState(false)
  const [manualExName, setManualExName] = useState('')
  const [manualExCardio, setManualExCardio] = useState(false)
  const [progressModal, setProgressModal] = useState(false)
  const [progressExName, setProgressExName] = useState('')
  const [progressData, setProgressData] = useState<{ date: string; max_weight: number; total_volume: number }[]>([])

  // ── Nutrition helpers ────────────────────────────────────
  const totals = foodLogs.reduce((acc, f) => ({
    calories: acc.calories + f.calories, protein: acc.protein + f.protein,
    carbs: acc.carbs + f.carbs, fat: acc.fat + f.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  async function loadNutritionHistory() {
    if (historyLoaded) { setShowNutritionCharts(v => !v); return }
    const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 29)
    const from = thirtyAgo.toISOString().split('T')[0]
    const { data } = await supabase.from('food_logs').select('date,calories,protein,carbs,fat')
      .eq('user_id', userId).gte('date', from).order('date')
    if (data) {
      const byDate: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {}
      data.forEach(r => {
        if (!byDate[r.date]) byDate[r.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 }
        byDate[r.date].calories += r.calories
        byDate[r.date].protein += r.protein
        byDate[r.date].carbs += r.carbs
        byDate[r.date].fat += r.fat
      })
      setNutritionHistory(Object.entries(byDate).map(([date, v]) => ({ date: date.slice(5), ...v })))
      setHistoryLoaded(true)
      setShowNutritionCharts(true)
    }
  }

  async function loadCustomFoods() {
    if (customLibraryLoaded) return
    const { data } = await supabase.from('custom_foods').select('*').eq('user_id', userId).order('name')
    setCustomFoods(data || [])
    setCustomLibraryLoaded(true)
  }

  async function saveCustomFood() {
    if (!newCustomFood.name.trim()) return
    const food: CustomFood = {
      id: crypto.randomUUID(), user_id: userId,
      name: newCustomFood.name,
      calories_100g: parseFloat(newCustomFood.calories_100g) || 0,
      protein_100g: parseFloat(newCustomFood.protein_100g) || 0,
      carbs_100g: parseFloat(newCustomFood.carbs_100g) || 0,
      fat_100g: parseFloat(newCustomFood.fat_100g) || 0,
    }
    setCustomFoods(prev => [...prev, food])
    await supabase.from('custom_foods').insert(food)
    setNewCustomFood({ name: '', calories_100g: '', protein_100g: '', carbs_100g: '', fat_100g: '' })
    toast.success('Food saved to library!')
    setFoodTab('library')
  }

  async function logCustomFood() {
    const src = selectedCustomFood
    if (!src) return
    const g = parseFloat(grams) || 100
    const ratio = g / 100
    const log: FoodLog = {
      id: crypto.randomUUID(), user_id: userId, date: today, meal: foodMeal,
      food_name: `${src.name} (${g}g)`,
      calories: Math.round(src.calories_100g * ratio),
      protein: Math.round(src.protein_100g * ratio * 10) / 10,
      carbs: Math.round(src.carbs_100g * ratio * 10) / 10,
      fat: Math.round(src.fat_100g * ratio * 10) / 10,
      serving_size: `${g}g`, created_at: new Date().toISOString(),
    }
    setFoodLogs(prev => [...prev, log])
    await supabase.from('food_logs').insert(log)
    toast.success('Logged!')
    setFoodModal(false); setSelectedCustomFood(null); setGrams('100')
  }

  async function logSearchFood() {
    if (!selectedFood) return
    const g = parseFloat(grams) || 100
    const nutrients = calcNutrition(selectedFood, g)
    const log: FoodLog = {
      id: crypto.randomUUID(), user_id: userId, date: today, meal: foodMeal,
      food_name: `${selectedFood.product_name} (${g}g)`,
      ...nutrients, serving_size: `${g}g`, created_at: new Date().toISOString(),
    }
    setFoodLogs(prev => [...prev, log])
    await supabase.from('food_logs').insert(log)
    toast.success('Logged!')
    setFoodModal(false); setSelectedFood(null); setGrams('100')
  }

  async function deleteFood(id: string) {
    setFoodLogs(prev => prev.filter(f => f.id !== id))
    await supabase.from('food_logs').delete().eq('id', id)
  }

  async function searchFoodHandler() {
    if (!foodQuery.trim()) return
    setFoodLoading(true); setFoodResults([]); setSelectedFood(null); setFoodSearchError(false)
    const results = await searchFood(foodQuery)
    if (results.length === 0) setFoodSearchError(true)
    setFoodResults(results); setFoodLoading(false)
  }

  async function saveGoals() {
    setGoals(goalsForm); setGoalsModal(false)
    await supabase.from('nutrition_goals').upsert({ user_id: userId, ...goalsForm, updated_at: new Date().toISOString() })
    toast.success('Goals updated!')
  }

  // ── Workout helpers ──────────────────────────────────────
  async function loadWorkoutForDay(day: DayOfWeek) {
    setActiveDay(day)
    const date = getTodayForDay(day)
    const { data: sess } = await supabase.from('workout_sessions').select('*')
      .eq('user_id', userId).eq('date', date).order('created_at')
    setSessions(sess || [])
    if (sess && sess.length > 0) {
      setActiveSession(sess[0])
      await loadSessionData(sess[0].id)
    } else {
      setActiveSession(null); setSessionExercises([]); setExerciseSets([])
    }
    setWorkoutLoaded(true)
  }

  function getTodayForDay(day: DayOfWeek): string {
    // For simplicity use today's date for "today's day", otherwise use today
    return today
  }

  async function loadSessionData(sessionId: string) {
    const { data: exs } = await supabase.from('session_exercises').select('*')
      .eq('session_id', sessionId).order('position')
    setSessionExercises(exs || [])
    if (exs && exs.length > 0) {
      const exIds = exs.map((e: SessionExercise) => e.id)
      const { data: sets } = await supabase.from('exercise_sets').select('*')
        .in('session_exercise_id', exIds).order('set_number')
      setExerciseSets(sets || [])
    }
  }

  async function createSession() {
    const sess: WorkoutSession = {
      id: crypto.randomUUID(), user_id: userId,
      date: today, name: sessionForm.name, notes: sessionForm.notes,
    }
    setSessions(prev => [...prev, sess])
    setActiveSession(sess)
    setSessionModal(false)
    setSessionForm({ name: 'Workout', notes: '' })
    await supabase.from('workout_sessions').insert(sess)
    toast.success('Session created!')
  }

  async function addExerciseToSession(name: string, muscleGroup: string, isCardio: boolean) {
    if (!activeSession) return
    const ex: SessionExercise = {
      id: crypto.randomUUID(), session_id: activeSession.id,
      exercise_name: name, muscle_group: muscleGroup,
      is_cardio: isCardio,
      position: sessionExercises.length,
    }
    setSessionExercises(prev => [...prev, ex])
    setExpandedExercise(ex.id)
    await supabase.from('session_exercises').insert({ ...ex, user_id: userId })
    setExModal(false); setManualExName(''); setExResults([])
  }

  async function addSet(exerciseId: string, isCardio: boolean) {
    const exSets = exerciseSets.filter(s => s.session_exercise_id === exerciseId)
    const newSet: ExerciseSet = {
      id: crypto.randomUUID(), session_exercise_id: exerciseId,
      set_number: exSets.length + 1, set_type: 'working',
      weight_kg: isCardio ? undefined : (exSets[exSets.length - 1]?.weight_kg || undefined),
      reps: isCardio ? undefined : (exSets[exSets.length - 1]?.reps || undefined),
      duration_minutes: isCardio ? 0 : undefined,
      completed: false,
    }
    setExerciseSets(prev => [...prev, newSet])
    await supabase.from('exercise_sets').insert({ ...newSet, user_id: userId })
  }

  async function updateSet(setId: string, updates: Partial<ExerciseSet>) {
    setExerciseSets(prev => prev.map(s => s.id === setId ? { ...s, ...updates } : s))
    await supabase.from('exercise_sets').update(updates).eq('id', setId)
  }

  async function deleteSet(setId: string) {
    setExerciseSets(prev => prev.filter(s => s.id !== setId))
    await supabase.from('exercise_sets').delete().eq('id', setId)
  }

  async function deleteExercise(exId: string) {
    setSessionExercises(prev => prev.filter(e => e.id !== exId))
    setExerciseSets(prev => prev.filter(s => s.session_exercise_id !== exId))
    await supabase.from('session_exercises').delete().eq('id', exId)
  }

  async function searchExercisesHandler() {
    setExLoading(true); setExResults([])
    const results = await searchExercises(exQuery, exMuscle || undefined)
    setExResults(results); setExLoading(false)
  }

  async function loadProgress(exName: string) {
    setProgressExName(exName)
    const { data } = await supabase.rpc('get_exercise_progress', { p_user_id: userId, p_exercise_name: exName })
      .then(() => supabase.from('exercise_sets')
        .select('session_exercise_id, weight_kg, reps, created_at, session_exercises!inner(exercise_name, user_id)')
        .eq('session_exercises.user_id', userId)
        .eq('session_exercises.exercise_name', exName)
        .eq('set_type', 'working')
        .not('weight_kg', 'is', null)
        .order('created_at'))

    // Group by date
    const byDate: Record<string, { weights: number[]; volumes: number[] }> = {}
    if (data) {
      data.forEach((r: { created_at: string; weight_kg: number; reps: number }) => {
        const d = r.created_at.split('T')[0]
        if (!byDate[d]) byDate[d] = { weights: [], volumes: [] }
        byDate[d].weights.push(r.weight_kg || 0)
        byDate[d].volumes.push((r.weight_kg || 0) * (r.reps || 0))
      })
    }
    setProgressData(Object.entries(byDate).map(([date, v]) => ({
      date: date.slice(5),
      max_weight: Math.max(...v.weights),
      total_volume: v.volumes.reduce((a, b) => a + b, 0),
    })))
    setProgressModal(true)
  }

  // PR detection
  function isPR(ex: SessionExercise): boolean {
    const sets = exerciseSets.filter(s => s.session_exercise_id === ex.id && s.set_type === 'working' && s.completed)
    if (sets.length === 0) return false
    const maxToday = Math.max(...sets.map(s => s.weight_kg || 0))
    return progressData.length > 0 && maxToday > Math.max(...progressData.map(d => d.max_weight))
  }

  // ── Init workout tab ─────────────────────────────────────
  function onWorkoutTabClick() {
    setActiveTab('workout')
    if (!workoutLoaded) loadWorkoutForDay(activeDay)
  }

  // ── Computed preview for custom food ────────────────────
  const customFoodPreview = useMemo(() => {
    if (!selectedCustomFood) return null
    const g = parseFloat(grams) || 100
    const ratio = g / 100
    return {
      calories: Math.round(selectedCustomFood.calories_100g * ratio),
      protein: Math.round(selectedCustomFood.protein_100g * ratio * 10) / 10,
      carbs: Math.round(selectedCustomFood.carbs_100g * ratio * 10) / 10,
      fat: Math.round(selectedCustomFood.fat_100g * ratio * 10) / 10,
    }
  }, [selectedCustomFood, grams])

  // ── Render ───────────────────────────────────────────────
  return (
    <div>
      {/* Tab Switch */}
      <div className="flex gap-1 p-1 rounded-lg border mb-6 w-fit"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        {([['nutrition', '🥗 Nutrition'], ['workout', '💪 Workout']] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => tab === 'workout' ? onWorkoutTabClick() : setActiveTab('nutrition')}
            className="px-5 py-2 rounded-md text-xs font-medium transition-all"
            style={{ background: activeTab === tab ? 'var(--surface3)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ════ NUTRITION TAB ════ */}
      {activeTab === 'nutrition' && (
        <div className="space-y-5">
          {/* Macro summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Calories', val: Math.round(totals.calories), goal: goals.calories, unit: 'kcal', color: 'var(--accent5)' },
              { label: 'Protein', val: Math.round(totals.protein), goal: goals.protein, unit: 'g', color: 'var(--accent2)' },
              { label: 'Carbs', val: Math.round(totals.carbs), goal: goals.carbs, unit: 'g', color: 'var(--accent4)' },
              { label: 'Fat', val: Math.round(totals.fat), goal: goals.fat, unit: 'g', color: 'var(--accent3)' },
            ].map(m => (
              <Card key={m.label}>
                <CardBody className="py-4">
                  <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
                  <div className="font-display font-extrabold text-2xl mb-0.5" style={{ color: m.color }}>
                    {m.val}<span className="text-sm font-mono font-normal ml-0.5">{m.unit}</span>
                  </div>
                  <div className="text-[10px] mb-2" style={{ color: 'var(--text-dim)' }}>of {m.goal}{m.unit}</div>
                  <div className="h-1 rounded-full" style={{ background: 'var(--surface3)' }}>
                    <div className="h-1 rounded-full transition-all" style={{ width: `${Math.min(100, Math.round(m.val / m.goal * 100))}%`, background: m.color }} />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          {/* Charts toggle */}
          <button onClick={loadNutritionHistory}
            className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg border transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--surface)' }}>
            {showNutritionCharts ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showNutritionCharts ? 'Hide' : 'Show'} 30-day history
          </button>

          {/* Nutrition Charts */}
          {showNutritionCharts && nutritionHistory.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><span className="font-display font-bold text-sm">Calories — 30 days</span></CardHeader>
                <CardBody>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={nutritionHistory} margin={{ left: -20, right: 5, top: 5, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gCal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fac86c" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#fac86c" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} interval={4} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="calories" stroke="#fac86c" fill="url(#gCal)" strokeWidth={2} dot={false} name="kcal" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>
              <Card>
                <CardHeader><span className="font-display font-bold text-sm">Macros — 30 days</span></CardHeader>
                <CardBody>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={nutritionHistory} margin={{ left: -20, right: 5, top: 5, bottom: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} interval={4} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Bar dataKey="protein" fill="#7b6cfa" name="Protein g" stackId="a" radius={[0,0,0,0]} />
                      <Bar dataKey="carbs" fill="#6cf0fa" name="Carbs g" stackId="a" />
                      <Bar dataKey="fat" fill="#fa6c6c" name="Fat g" stackId="a" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>
            </div>
          )}

          {/* Meal sections */}
          <div className="grid md:grid-cols-2 gap-4">
            {MEALS.map(meal => {
              const mealLogs = foodLogs.filter(f => f.meal === meal)
              const mealCals = mealLogs.reduce((s, f) => s + f.calories, 0)
              return (
                <Card key={meal}>
                  <CardHeader>
                    <span className="font-display font-bold text-sm">{meal}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: 'var(--accent5)' }}>{Math.round(mealCals)} kcal</span>
                      <Button size="sm" variant="ghost" onClick={() => { setFoodMeal(meal); setFoodModal(true); setFoodTab('search') }}>
                        <Plus size={12} /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardBody className="py-3 space-y-1.5">
                    {mealLogs.map(food => (
                      <div key={food.id} className="group flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--surface2)' }}>
                        <div>
                          <div className="text-xs font-medium">{food.food_name}</div>
                          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {Math.round(food.calories)}kcal · {food.protein}g P · {food.carbs}g C · {food.fat}g F
                          </div>
                        </div>
                        <button onClick={() => deleteFood(food.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1" style={{ color: 'var(--text-dim)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent3)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {mealLogs.length === 0 && <p className="text-xs text-center py-2" style={{ color: 'var(--text-dim)' }}>No food logged</p>}
                  </CardBody>
                </Card>
              )
            })}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => { setGoalsForm(goals); setGoalsModal(true) }}>
              <Settings size={13} /> Edit Goals
            </Button>
          </div>
        </div>
      )}

      {/* ════ WORKOUT TAB ════ */}
      {activeTab === 'workout' && (
        <div>
          {/* Day tabs */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-1 flex-wrap">
              {DAYS_OF_WEEK.map(day => (
                <button key={day} onClick={() => loadWorkoutForDay(day)}
                  className="px-3 py-1.5 rounded-full text-xs border transition-all"
                  style={{ background: activeDay === day ? 'var(--accent)' : 'transparent', color: activeDay === day ? '#0e0e10' : 'var(--text-muted)', borderColor: activeDay === day ? 'var(--accent)' : 'var(--border)', fontWeight: activeDay === day ? 600 : 400 }}>
                  {day}
                </button>
              ))}
            </div>
            <Button variant="accent" onClick={() => setSessionModal(true)}><Plus size={13} /> New Session</Button>
          </div>

          {/* Sessions */}
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="text-3xl mb-3">🏋️</div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No session for this day yet</p>
              <Button variant="accent" onClick={() => setSessionModal(true)}><Plus size={13} /> Start Session</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Session selector if multiple */}
              {sessions.length > 1 && (
                <div className="flex gap-2">
                  {sessions.map(s => (
                    <button key={s.id} onClick={async () => { setActiveSession(s); await loadSessionData(s.id) }}
                      className="px-3 py-1.5 rounded-lg text-xs border transition-all"
                      style={{ background: activeSession?.id === s.id ? 'var(--accent)' : 'var(--surface)', color: activeSession?.id === s.id ? '#0e0e10' : 'var(--text-muted)', borderColor: 'var(--border)' }}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              {activeSession && (
                <Card>
                  <CardHeader>
                    <span className="font-display font-bold text-base">{activeSession.name}</span>
                    <Button size="sm" variant="accent" onClick={() => setExModal(true)}><Plus size={12} /> Add Exercise</Button>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    {sessionExercises.map(ex => {
                      const sets = exerciseSets.filter(s => s.session_exercise_id === ex.id)
                      const isExpanded = expandedExercise === ex.id
                      const completedSets = sets.filter(s => s.completed).length
                      const pr = isPR(ex)
                      return (
                        <div key={ex.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                          {/* Exercise header */}
                          <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                            style={{ background: 'var(--surface2)' }}
                            onClick={() => setExpandedExercise(isExpanded ? null : ex.id)}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{ex.exercise_name}</span>
                                {pr && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--accent)', color: '#0e0e10' }}>🏆 PR</span>}
                              </div>
                              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {ex.muscle_group && `${MUSCLE_ICONS[ex.muscle_group] || '💪'} ${ex.muscle_group} · `}
                                {ex.is_cardio ? '🏃 Cardio' : `${completedSets}/${sets.length} sets`}
                              </div>
                            </div>
                            <button onClick={e => { e.stopPropagation(); loadProgress(ex.exercise_name) }}
                              className="p-1.5 rounded-lg transition-all" style={{ color: 'var(--text-muted)' }}
                              title="View progress">
                              <BookOpen size={14} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); deleteExercise(ex.id) }}
                              className="p-1.5 rounded-lg transition-all" style={{ color: 'var(--text-dim)' }}
                              onMouseEnter={e2 => (e2.currentTarget.style.color = 'var(--accent3)')} onMouseLeave={e2 => (e2.currentTarget.style.color = 'var(--text-dim)')}>
                              <Trash2 size={14} />
                            </button>
                            {isExpanded ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
                          </div>

                          {/* Sets table */}
                          {isExpanded && (
                            <div className="px-4 py-3" style={{ background: 'var(--surface)' }}>
                              {/* Header */}
                              <div className="grid gap-2 mb-2 text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-dim)', gridTemplateColumns: ex.is_cardio ? '40px 1fr 1fr 1fr 80px 36px' : '40px 120px 1fr 1fr 80px 36px' }}>
                                <span>#</span>
                                <span>Type</span>
                                {ex.is_cardio ? <><span>Minutes</span><span>Distance km</span></> : <><span>Weight kg</span><span>Reps</span></>}
                                <span>Done</span>
                                <span></span>
                              </div>

                              {sets.map(set => (
                                <div key={set.id} className="grid gap-2 mb-2 items-center"
                                  style={{ gridTemplateColumns: ex.is_cardio ? '40px 1fr 1fr 1fr 80px 36px' : '40px 120px 1fr 1fr 80px 36px' }}>
                                  {/* Set number */}
                                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{set.set_number}</span>

                                  {/* Set type */}
                                  <select value={set.set_type}
                                    onChange={e => updateSet(set.id, { set_type: e.target.value as ExerciseSet['set_type'] })}
                                    className="px-2 py-1 rounded-md text-[10px] border outline-none cursor-pointer"
                                    style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: SET_TYPES.find(t => t.value === set.set_type)?.color || 'var(--text)' }}>
                                    {SET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                  </select>

                                  {ex.is_cardio ? (
                                    <>
                                      <input type="number" value={set.duration_minutes ?? ''} placeholder="0"
                                        onChange={e => updateSet(set.id, { duration_minutes: parseFloat(e.target.value) || 0 })}
                                        className="px-2 py-1 rounded-md text-xs border outline-none w-full"
                                        style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                                      <input type="number" value={set.distance_km ?? ''} placeholder="0"
                                        onChange={e => updateSet(set.id, { distance_km: parseFloat(e.target.value) || 0 })}
                                        className="px-2 py-1 rounded-md text-xs border outline-none w-full"
                                        style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                                    </>
                                  ) : (
                                    <>
                                      <input type="number" value={set.weight_kg ?? ''} placeholder="0"
                                        onChange={e => updateSet(set.id, { weight_kg: parseFloat(e.target.value) || 0 })}
                                        className="px-2 py-1 rounded-md text-xs border outline-none w-full"
                                        style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                                      <input type="number" value={set.reps ?? ''} placeholder="0"
                                        onChange={e => updateSet(set.id, { reps: parseInt(e.target.value) || 0 })}
                                        className="px-2 py-1 rounded-md text-xs border outline-none w-full"
                                        style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                                    </>
                                  )}

                                  {/* Done toggle */}
                                  <button onClick={() => updateSet(set.id, { completed: !set.completed })}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border transition-all"
                                    style={{ borderColor: set.completed ? 'var(--accent)' : 'var(--border)', background: set.completed ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent', color: set.completed ? 'var(--accent)' : 'var(--text-muted)' }}>
                                    {set.completed ? <CheckCircle size={11} /> : <Circle size={11} />}
                                    {set.completed ? 'Done' : 'Mark'}
                                  </button>

                                  {/* Delete */}
                                  <button onClick={() => deleteSet(set.id)} className="p-1 rounded transition-all" style={{ color: 'var(--text-dim)' }}
                                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent3)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}

                              <button onClick={() => addSet(ex.id, ex.is_cardio)}
                                className="mt-2 w-full py-2 rounded-lg border border-dashed text-xs transition-all"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}>
                                + Add Set
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {sessionExercises.length === 0 && (
                      <p className="text-xs text-center py-8" style={{ color: 'var(--text-dim)' }}>No exercises yet — add your first one</p>
                    )}
                  </CardBody>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════ MODALS ════ */}

      {/* Food Modal */}
      <Modal open={foodModal} onClose={() => setFoodModal(false)} title={`Log Food — ${foodMeal}`} width="max-w-xl">
        <div className="space-y-4">
          <Select label="Meal" value={foodMeal} onChange={e => setFoodMeal(e.target.value as MealType)}
            options={MEALS.map(m => ({ value: m, label: m }))} />

          {/* Food tabs */}
          <div className="flex gap-1 p-1 rounded-lg border" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
            {([['search', '🔍 Search DB'], ['library', '📚 My Library'], ['custom', '➕ Create New']] as const).map(([t, label]) => (
              <button key={t} onClick={() => { setFoodTab(t); if (t === 'library') loadCustomFoods() }}
                className="flex-1 py-1.5 rounded-md text-[10px] transition-all font-medium"
                style={{ background: foodTab === t ? 'var(--surface3)' : 'transparent', color: foodTab === t ? 'var(--accent)' : 'var(--text-muted)' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Search tab */}
          {foodTab === 'search' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Search Open Food Facts..." value={foodQuery}
                  onChange={e => setFoodQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchFoodHandler()} className="flex-1" />
                <Button onClick={searchFoodHandler} disabled={foodLoading} variant="accent">
                  {foodLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                </Button>
              </div>
              {foodSearchError && <p className="text-xs px-1" style={{ color: 'var(--accent3)' }}>⚠ API unavailable — use My Library or Create New instead.</p>}
              {foodResults.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {foodResults.map((r, i) => (
                    <button key={i} onClick={() => setSelectedFood(r)}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all"
                      style={{ background: selectedFood === r ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface3)', border: selectedFood === r ? '1px solid var(--accent)' : '1px solid transparent' }}>
                      <div className="font-medium">{r.product_name}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{r.brands && `${r.brands} · `}{r.nutriments['energy-kcal_100g']?.toFixed(0)}kcal /100g</div>
                    </button>
                  ))}
                </div>
              )}
              {selectedFood && (
                <div className="flex items-center gap-3">
                  <Input placeholder="Grams" type="number" value={grams} onChange={e => setGrams(e.target.value)} className="w-24" />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>= {calcNutrition(selectedFood, parseFloat(grams) || 100).calories} kcal</span>
                  <Button variant="accent" onClick={logSearchFood} disabled={!selectedFood}>Log</Button>
                </div>
              )}
            </div>
          )}

          {/* My Library tab */}
          {foodTab === 'library' && (
            <div className="space-y-2">
              {customFoods.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-dim)' }}>No saved foods yet — create one in the next tab</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {customFoods.map(f => (
                    <button key={f.id} onClick={() => setSelectedCustomFood(f)}
                      className="w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all"
                      style={{ background: selectedCustomFood?.id === f.id ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface2)', border: selectedCustomFood?.id === f.id ? '1px solid var(--accent)' : '1px solid transparent' }}>
                      <div className="font-medium">{f.name}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{f.calories_100g} kcal · {f.protein_100g}g P · {f.carbs_100g}g C · {f.fat_100g}g F <span style={{ color: 'var(--text-dim)' }}>(per 100g)</span></div>
                    </button>
                  ))}
                </div>
              )}
              {selectedCustomFood && (
                <div className="p-3 rounded-lg border space-y-2" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <Input placeholder="Grams" type="number" value={grams} onChange={e => setGrams(e.target.value)} className="w-24" label="Quantity (g)" />
                    <div className="flex-1 pt-4">
                      {customFoodPreview && (
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {customFoodPreview.calories} kcal · {customFoodPreview.protein}g P · {customFoodPreview.carbs}g C · {customFoodPreview.fat}g F
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="accent" onClick={logCustomFood} className="w-full">Log {selectedCustomFood.name}</Button>
                </div>
              )}
            </div>
          )}

          {/* Create New tab */}
          {foodTab === 'custom' && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enter macros per 100g. It will be saved to your library.</p>
              <Input label="Food Name" placeholder="e.g. Homemade Protein Shake" value={newCustomFood.name}
                onChange={e => setNewCustomFood(p => ({ ...p, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Calories (kcal/100g)" type="number" placeholder="0" value={newCustomFood.calories_100g}
                  onChange={e => setNewCustomFood(p => ({ ...p, calories_100g: e.target.value }))} />
                <Input label="Protein (g/100g)" type="number" placeholder="0" value={newCustomFood.protein_100g}
                  onChange={e => setNewCustomFood(p => ({ ...p, protein_100g: e.target.value }))} />
                <Input label="Carbs (g/100g)" type="number" placeholder="0" value={newCustomFood.carbs_100g}
                  onChange={e => setNewCustomFood(p => ({ ...p, carbs_100g: e.target.value }))} />
                <Input label="Fat (g/100g)" type="number" placeholder="0" value={newCustomFood.fat_100g}
                  onChange={e => setNewCustomFood(p => ({ ...p, fat_100g: e.target.value }))} />
              </div>
              <Button variant="accent" onClick={saveCustomFood} className="w-full">Save to Library</Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Session Modal */}
      <Modal open={sessionModal} onClose={() => setSessionModal(false)} title="New Workout Session">
        <div className="space-y-4">
          <Input label="Session Name" placeholder="e.g. Push Day, Legs, Cardio..." value={sessionForm.name}
            onChange={e => setSessionForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Notes (optional)" placeholder="Goals, focus areas..." value={sessionForm.notes}
            onChange={e => setSessionForm(p => ({ ...p, notes: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setSessionModal(false)}>Cancel</Button>
            <Button variant="accent" onClick={createSession}>Create Session</Button>
          </div>
        </div>
      </Modal>

      {/* Exercise Search Modal */}
      <Modal open={exModal} onClose={() => setExModal(false)} title="Add Exercise" width="max-w-xl">
        <div className="space-y-4">
          {/* Manual add */}
          <div className="p-3 rounded-lg border space-y-3" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Add Manually</p>
            <div className="flex gap-2">
              <Input placeholder="Exercise name..." value={manualExName} onChange={e => setManualExName(e.target.value)} className="flex-1" />
              <label className="flex items-center gap-2 text-xs cursor-pointer px-3 py-2 rounded-lg border whitespace-nowrap"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: manualExCardio ? 'color-mix(in srgb, var(--accent4) 15%, transparent)' : 'transparent' }}>
                <input type="checkbox" checked={manualExCardio} onChange={e => setManualExCardio(e.target.checked)} className="rounded" />
                Cardio
              </label>
              <Button variant="accent" onClick={() => manualExName.trim() && addExerciseToSession(manualExName, '', manualExCardio)}>Add</Button>
            </div>
          </div>

          {/* API search */}
          <div className="p-3 rounded-lg border space-y-3" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Search Exercise Database</p>
            <div className="flex gap-2">
              <Input placeholder="Exercise name..." value={exQuery} onChange={e => setExQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchExercisesHandler()} className="flex-1" />
              <select value={exMuscle} onChange={e => setExMuscle(e.target.value)}
                className="px-3 py-2 rounded-lg text-xs border outline-none"
                style={{ background: 'var(--surface3)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value="">All muscles</option>
                {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <Button onClick={searchExercisesHandler} disabled={exLoading} variant="accent">
                {exLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              </Button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {exResults.map((ex, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl border"
                  style={{ background: 'var(--surface3)', borderColor: 'var(--border)' }}>
                  <div>
                    <div className="text-xs font-medium capitalize">{ex.name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{MUSCLE_ICONS[ex.muscle] || '💪'} {ex.muscle} · {ex.equipment}</div>
                  </div>
                  <Button size="sm" variant="accent" onClick={() => addExerciseToSession(ex.name, ex.muscle, false)}><Plus size={11} /></Button>
                </div>
              ))}
              {exResults.length === 0 && exQuery && !exLoading && (
                <p className="text-xs text-center py-3" style={{ color: 'var(--text-dim)' }}>No results — try manual entry above</p>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Progress Modal */}
      <Modal open={progressModal} onClose={() => setProgressModal(false)} title={`Progress — ${progressExName}`} width="max-w-lg">
        {progressData.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-dim)' }}>No history yet — complete some sets first</p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-xs mb-2 tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Max Weight (kg)</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={progressData} margin={{ left: -20, right: 5, top: 5, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="max_weight" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} name="Max kg" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs mb-2 tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Total Volume (kg × reps)</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={progressData} margin={{ left: -20, right: 5, top: 5, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="total_volume" fill="var(--accent2)" radius={[4, 4, 0, 0]} name="Volume" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Modal>

      {/* Goals Modal */}
      <Modal open={goalsModal} onClose={() => setGoalsModal(false)} title="Nutrition Goals">
        <div className="space-y-4">
          <Input label="Daily Calories (kcal)" type="number" value={String(goalsForm.calories)} onChange={e => setGoalsForm(p => ({ ...p, calories: parseInt(e.target.value) || 0 }))} />
          <Input label="Protein Goal (g)" type="number" value={String(goalsForm.protein)} onChange={e => setGoalsForm(p => ({ ...p, protein: parseInt(e.target.value) || 0 }))} />
          <Input label="Carbs Goal (g)" type="number" value={String(goalsForm.carbs)} onChange={e => setGoalsForm(p => ({ ...p, carbs: parseInt(e.target.value) || 0 }))} />
          <Input label="Fat Goal (g)" type="number" value={String(goalsForm.fat)} onChange={e => setGoalsForm(p => ({ ...p, fat: parseInt(e.target.value) || 0 }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setGoalsModal(false)}>Cancel</Button>
            <Button variant="accent" onClick={saveGoals}>Save Goals</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
