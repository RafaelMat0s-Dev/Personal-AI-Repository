'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FoodLog, NutritionGoals, MealType, DayOfWeek } from '@/types'
import { DAYS_OF_WEEK } from '@/lib/utils'
import { Button, Modal, Input, Select, Card, CardHeader, CardBody } from '@/components/ui'
import { searchFood, calcNutrition } from '@/lib/api/food'
import { searchExercises, MUSCLE_GROUPS, MUSCLE_ICONS } from '@/lib/api/exercises'
import {
  Plus, Search, Loader2, Trash2, CheckCircle, Circle, Settings,
  ChevronLeft, ChevronRight, Play, Square, Clock, ChevronDown,
  ChevronUp, BookOpen, Dumbbell, LayoutTemplate, X, Timer,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  format, addDays, subDays, parseISO, differenceInSeconds,
} from 'date-fns'
import toast from 'react-hot-toast'

// ─── Types ───────────────────────────────────────────────────
const MEALS: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

interface CustomFood {
  id: string; user_id: string; name: string
  calories_100g: number; protein_100g: number
  carbs_100g: number; fat_100g: number
}
interface FoodSearchResult {
  product_name: string; brands?: string
  nutriments: { 'energy-kcal_100g'?: number; proteins_100g?: number; carbohydrates_100g?: number; fat_100g?: number }
}
interface TemplateExercise {
  id: string; template_id: string; exercise_name: string
  muscle_group?: string; is_cardio: boolean
  default_sets: number; default_reps?: number; default_weight_kg?: number; position: number
}
interface WorkoutTemplate {
  id: string; user_id: string; name: string; description?: string
  exercises?: TemplateExercise[]
}
interface WorkoutSession {
  id: string; user_id: string; date: string; name: string; notes?: string
  started_at?: string; finished_at?: string; duration_seconds?: number
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

const SET_TYPES = [
  { value: 'working', label: 'Working', color: '#c8fa5f' },
  { value: 'warmup',  label: 'Warm-up', color: '#fac86c' },
  { value: 'dropset', label: 'Drop Set', color: '#fa6c6c' },
]

const TOOLTIP_STYLE = {
  contentStyle: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: 'var(--text)' },
  labelStyle: { color: 'var(--text-muted)', fontSize: '10px' },
}

function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

// ─── Session Timer ────────────────────────────────────────────
function SessionTimer({ startedAt, onEnd }: { startedAt: string; onEnd: () => void }) {
  const [elapsed, setElapsed] = useState(differenceInSeconds(new Date(), parseISO(startedAt)))
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(differenceInSeconds(new Date(), parseISO(startedAt)))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
      style={{ background: 'color-mix(in srgb, var(--accent) 8%, var(--surface))', borderColor: 'var(--accent)' }}>
      <Timer size={16} style={{ color: 'var(--accent)' }} className="animate-pulse-slow" />
      <div className="flex-1">
        <div className="font-display font-extrabold text-xl" style={{ color: 'var(--accent)' }}>
          {fmtDuration(elapsed)}
        </div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Session in progress</div>
      </div>
      <Button variant="danger" size="sm" onClick={onEnd}>
        <Square size={12} /> End Session
      </Button>
    </div>
  )
}

// ─── Finished Session Card ─────────────────────────────────────
function SessionCard({
  session, exercises, sets, onDelete,
}: {
  session: WorkoutSession
  exercises: SessionExercise[]
  sets: ExerciseSet[]
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const totalSets = sets.filter(s => s.completed).length
  const exCount = exercises.length

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {/* Card header */}
      <button
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
        style={{ background: 'var(--surface)' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--accent2) 15%, transparent)' }}>
          <Dumbbell size={18} style={{ color: 'var(--accent2)' }} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-display font-bold text-sm">{session.name}</div>
          <div className="text-[10px] mt-0.5 flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
            {session.duration_seconds != null && (
              <span className="flex items-center gap-1"><Clock size={10} /> {fmtDuration(session.duration_seconds)}</span>
            )}
            <span>{exCount} exercise{exCount !== 1 ? 's' : ''}</span>
            <span>{totalSets} sets done</span>
            {session.finished_at && (
              <span>{format(parseISO(session.finished_at), 'HH:mm')}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent3)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t px-5 py-4 space-y-4" style={{ borderColor: 'var(--border)' }}>
          {exercises.map(ex => {
            const exSets = sets.filter(s => s.session_exercise_id === ex.id)
            return (
              <div key={ex.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">{ex.exercise_name}</span>
                  {ex.muscle_group && (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {MUSCLE_ICONS[ex.muscle_group] || '💪'} {ex.muscle_group}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {exSets.map(set => (
                    <div key={set.id} className="flex items-center gap-3 text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: 'var(--surface2)' }}>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: `color-mix(in srgb, ${SET_TYPES.find(t => t.value === set.set_type)?.color} 20%, transparent)`, color: SET_TYPES.find(t => t.value === set.set_type)?.color }}>
                        {SET_TYPES.find(t => t.value === set.set_type)?.label}
                      </span>
                      {ex.is_cardio ? (
                        <span style={{ color: 'var(--text-muted)' }}>{set.duration_minutes ?? '—'} min{set.distance_km ? ` · ${set.distance_km} km` : ''}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>{set.weight_kg ?? '—'} kg × {set.reps ?? '—'} reps</span>
                      )}
                      {set.completed && <CheckCircle size={12} style={{ color: 'var(--accent)', marginLeft: 'auto' }} />}
                    </div>
                  ))}
                  {exSets.length === 0 && (
                    <div className="text-xs" style={{ color: 'var(--text-dim)' }}>No sets logged</div>
                  )}
                </div>
              </div>
            )
          })}
          {session.notes && (
            <p className="text-xs pt-2 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              📝 {session.notes}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────
export default function FitnessClient({
  userId, initialGoals, initialFoodLogs, today,
}: {
  userId: string
  initialGoals: NutritionGoals
  initialFoodLogs: FoodLog[]
  today: string
}) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'nutrition' | 'workout'>('nutrition')

  // ── Date navigation (shared) ─────────────────────────────
  const [currentDate, setCurrentDate] = useState(today)
  const isToday = currentDate === today

  function prevDay() { setCurrentDate(format(subDays(parseISO(currentDate), 1), 'yyyy-MM-dd')) }
  function nextDay() { setCurrentDate(format(addDays(parseISO(currentDate), 1), 'yyyy-MM-dd')) }
  function goToday()  { setCurrentDate(today) }

  // ── NUTRITION STATE ──────────────────────────────────────
  const [goals, setGoals] = useState<NutritionGoals>(initialGoals)
  const [foodLogsByDate, setFoodLogsByDate] = useState<Record<string, FoodLog[]>>({
    [today]: initialFoodLogs,
  })
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([])
  const [nutritionHistory, setNutritionHistory] = useState<{ date: string; calories: number; protein: number; carbs: number; fat: number }[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [showNutritionCharts, setShowNutritionCharts] = useState(false)

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
  const [newCustomFood, setNewCustomFood] = useState({ name: '', calories_100g: '', protein_100g: '', carbs_100g: '', fat_100g: '' })
  const [goalsModal, setGoalsModal] = useState(false)
  const [goalsForm, setGoalsForm] = useState<NutritionGoals>(goals)

  // ── WORKOUT STATE ────────────────────────────────────────
  // Templates
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [templatesLoaded, setTemplatesLoaded] = useState(false)
  const [templateModal, setTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({ name: '', description: '' })
  const [templateExForm, setTemplateExForm] = useState({ name: '', muscle: '', is_cardio: false, sets: '3', reps: '', weight: '' })
  const [templateExSearch, setTemplateExSearch] = useState('')
  const [templateExResults, setTemplateExResults] = useState<{ name: string; muscle: string; equipment: string }[]>([])
  const [templateExLoading, setTemplateExLoading] = useState(false)

  // Sessions for current date
  const [sessionsByDate, setSessionsByDate] = useState<Record<string, WorkoutSession[]>>({})
  const [exercisesBySession, setExercisesBySession] = useState<Record<string, SessionExercise[]>>({})
  const [setsByExercise, setSetsByExercise] = useState<Record<string, ExerciseSet[]>>({})
  const [workoutLoadedDates, setWorkoutLoadedDates] = useState<Set<string>>(new Set())

  // Active session (in progress)
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null)
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)

  // Session modals
  const [startModal, setStartModal] = useState(false)
  const [sessionForm, setSessionForm] = useState({ name: 'Workout', notes: '', template_id: '' })
  const [exModal, setExModal] = useState(false)
  const [exQuery, setExQuery] = useState('')
  const [exMuscle, setExMuscle] = useState('')
  const [exResults, setExResults] = useState<{ name: string; muscle: string; equipment: string; difficulty: string }[]>([])
  const [exLoading, setExLoading] = useState(false)
  const [manualExName, setManualExName] = useState('')
  const [manualExCardio, setManualExCardio] = useState(false)

  // ── Helpers ──────────────────────────────────────────────
  const foodLogs = foodLogsByDate[currentDate] || []
  const sessions = sessionsByDate[currentDate] || []

  const totals = foodLogs.reduce((acc, f) => ({
    calories: acc.calories + f.calories, protein: acc.protein + f.protein,
    carbs: acc.carbs + f.carbs, fat: acc.fat + f.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  // ── Load food logs for a date ────────────────────────────
  async function loadFoodLogs(date: string) {
    if (foodLogsByDate[date]) return
    const { data } = await supabase.from('food_logs').select('*')
      .eq('user_id', userId).eq('date', date).order('created_at')
    setFoodLogsByDate(prev => ({ ...prev, [date]: data || [] }))
  }

  // ── Load workout sessions for a date ────────────────────
  async function loadWorkoutSessions(date: string) {
    if (workoutLoadedDates.has(date)) return
    const { data: sess } = await supabase.from('workout_sessions').select('*')
      .eq('user_id', userId).eq('date', date).order('created_at')
    const sessData = sess || []
    setSessionsByDate(prev => ({ ...prev, [date]: sessData }))

    if (sessData.length > 0) {
      // Load exercises + sets for each session
      for (const s of sessData) {
        const { data: exs } = await supabase.from('session_exercises').select('*')
          .eq('session_id', s.id).order('position')
        setExercisesBySession(prev => ({ ...prev, [s.id]: exs || [] }))
        if (exs && exs.length > 0) {
          const exIds = exs.map((e: SessionExercise) => e.id)
          const { data: sets } = await supabase.from('exercise_sets').select('*')
            .in('session_exercise_id', exIds).order('set_number')
          const byEx: Record<string, ExerciseSet[]> = {}
          for (const set of (sets || [])) {
            if (!byEx[set.session_exercise_id]) byEx[set.session_exercise_id] = []
            byEx[set.session_exercise_id].push(set)
          }
          setSetsByExercise(prev => ({ ...prev, ...byEx }))
        }
        // Check if this session is in progress
        if (s.started_at && !s.finished_at) setActiveSession(s)
      }
    }
    setWorkoutLoadedDates(prev => new Set([...prev, date]))
  }

  // When date or tab changes, load data
  useEffect(() => {
    if (activeTab === 'nutrition') loadFoodLogs(currentDate)
    else loadWorkoutSessions(currentDate)
  }, [currentDate, activeTab])

  // ── Load templates ────────────────────────────────────────
  async function loadTemplates() {
    if (templatesLoaded) return
    const { data } = await supabase.from('workout_templates').select('*, exercises:template_exercises(*)')
      .eq('user_id', userId).order('created_at')
    setTemplates(data || [])
    setTemplatesLoaded(true)
  }

  // ── NUTRITION handlers ────────────────────────────────────
  async function loadNutritionHistory() {
    if (historyLoaded) { setShowNutritionCharts(v => !v); return }
    const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 29)
    const from = thirtyAgo.toISOString().split('T')[0]
    const { data } = await supabase.from('food_logs').select('date,calories,protein,carbs,fat')
      .eq('user_id', userId).gte('date', from).order('date')
    if (data) {
      const byDate: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {}
      data.forEach((r: { date: string; calories: number; protein: number; carbs: number; fat: number }) => {
        if (!byDate[r.date]) byDate[r.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 }
        byDate[r.date].calories += r.calories
        byDate[r.date].protein  += r.protein
        byDate[r.date].carbs    += r.carbs
        byDate[r.date].fat      += r.fat
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
      id: crypto.randomUUID(), user_id: userId, name: newCustomFood.name,
      calories_100g: parseFloat(newCustomFood.calories_100g) || 0,
      protein_100g:  parseFloat(newCustomFood.protein_100g)  || 0,
      carbs_100g:    parseFloat(newCustomFood.carbs_100g)    || 0,
      fat_100g:      parseFloat(newCustomFood.fat_100g)      || 0,
    }
    setCustomFoods(prev => [...prev, food])
    await supabase.from('custom_foods').insert(food)
    setNewCustomFood({ name: '', calories_100g: '', protein_100g: '', carbs_100g: '', fat_100g: '' })
    toast.success('Saved to library!'); setFoodTab('library')
  }

  async function logFood(log: FoodLog) {
    setFoodLogsByDate(prev => ({ ...prev, [currentDate]: [...(prev[currentDate] || []), log] }))
    await supabase.from('food_logs').insert(log)
    toast.success('Logged!')
    setFoodModal(false); setSelectedFood(null); setSelectedCustomFood(null); setGrams('100')
  }

  async function logSearchFood() {
    if (!selectedFood) return
    const g = parseFloat(grams) || 100
    const nutrients = calcNutrition(selectedFood as Parameters<typeof calcNutrition>[0], g)
    await logFood({
      id: crypto.randomUUID(), user_id: userId, date: currentDate, meal: foodMeal,
      food_name: `${selectedFood.product_name} (${g}g)`,
      ...nutrients, serving_size: `${g}g`, created_at: new Date().toISOString(),
    })
  }

  async function logCustomFood() {
    if (!selectedCustomFood) return
    const g = parseFloat(grams) || 100; const ratio = g / 100
    await logFood({
      id: crypto.randomUUID(), user_id: userId, date: currentDate, meal: foodMeal,
      food_name: `${selectedCustomFood.name} (${g}g)`,
      calories: Math.round(selectedCustomFood.calories_100g * ratio),
      protein:  Math.round(selectedCustomFood.protein_100g  * ratio * 10) / 10,
      carbs:    Math.round(selectedCustomFood.carbs_100g    * ratio * 10) / 10,
      fat:      Math.round(selectedCustomFood.fat_100g      * ratio * 10) / 10,
      serving_size: `${g}g`, created_at: new Date().toISOString(),
    })
  }

  async function deleteFood(id: string) {
    setFoodLogsByDate(prev => ({ ...prev, [currentDate]: (prev[currentDate] || []).filter(f => f.id !== id) }))
    await supabase.from('food_logs').delete().eq('id', id)
  }

  async function searchFoodHandler() {
    if (!foodQuery.trim()) return
    setFoodLoading(true); setFoodResults([]); setSelectedFood(null); setFoodSearchError(false)
    const results = await searchFood(foodQuery)
    if (results.length === 0) setFoodSearchError(true)
    setFoodResults(results as FoodSearchResult[]); setFoodLoading(false)
  }

  async function saveGoals() {
    setGoals(goalsForm); setGoalsModal(false)
    await supabase.from('nutrition_goals').upsert({ user_id: userId, ...goalsForm, updated_at: new Date().toISOString() })
    toast.success('Goals updated!')
  }

  const customFoodPreview = useMemo(() => {
    if (!selectedCustomFood) return null
    const g = parseFloat(grams) || 100; const ratio = g / 100
    return {
      calories: Math.round(selectedCustomFood.calories_100g * ratio),
      protein:  Math.round(selectedCustomFood.protein_100g  * ratio * 10) / 10,
      carbs:    Math.round(selectedCustomFood.carbs_100g    * ratio * 10) / 10,
      fat:      Math.round(selectedCustomFood.fat_100g      * ratio * 10) / 10,
    }
  }, [selectedCustomFood, grams])

  // ── WORKOUT handlers ──────────────────────────────────────

  // Create session (optionally from template)
  async function createSession() {
    const now = new Date().toISOString()
    const sess: WorkoutSession = {
      id: crypto.randomUUID(), user_id: userId, date: currentDate,
      name: sessionForm.name, notes: sessionForm.notes, started_at: now,
    }
    await supabase.from('workout_sessions').insert(sess)

    // If template chosen, seed exercises + sets
    if (sessionForm.template_id) {
      const tpl = templates.find(t => t.id === sessionForm.template_id)
      const exs: SessionExercise[] = []
      if (tpl?.exercises) {
        for (let i = 0; i < tpl.exercises.length; i++) {
          const te = tpl.exercises[i]
          const ex: SessionExercise = {
            id: crypto.randomUUID(), session_id: sess.id,
            exercise_name: te.exercise_name, muscle_group: te.muscle_group,
            is_cardio: te.is_cardio, position: i,
          }
          exs.push(ex)
        }
        await supabase.from('session_exercises').insert(exs.map(e => ({ ...e, user_id: userId })))

        // Seed default sets
        const allSets: ExerciseSet[] = []
        const byEx: Record<string, ExerciseSet[]> = {}
        for (let ei = 0; ei < tpl.exercises.length; ei++) {
          const te = tpl.exercises[ei]
          const ex = exs[ei]
          byEx[ex.id] = []
          for (let si = 0; si < (te.default_sets || 3); si++) {
            const set: ExerciseSet = {
              id: crypto.randomUUID(), session_exercise_id: ex.id,
              set_number: si + 1, set_type: 'working',
              weight_kg: te.default_weight_kg, reps: te.default_reps,
              completed: false,
            }
            byEx[ex.id].push(set)
            allSets.push(set)
          }
        }
        await supabase.from('exercise_sets').insert(allSets.map(s => ({ ...s, user_id: userId })))
        setExercisesBySession(prev => ({ ...prev, [sess.id]: exs }))
        setSetsByExercise(prev => ({ ...prev, ...byEx }))
      }
    } else {
      setExercisesBySession(prev => ({ ...prev, [sess.id]: [] }))
    }

    setSessionsByDate(prev => ({ ...prev, [currentDate]: [...(prev[currentDate] || []), sess] }))
    setActiveSession(sess)
    setStartModal(false)
    setSessionForm({ name: 'Workout', notes: '', template_id: '' })
    toast.success('Session started!')
  }

  async function endSession() {
    if (!activeSession) return
    const finishedAt = new Date().toISOString()
    const durationSeconds = differenceInSeconds(new Date(), parseISO(activeSession.started_at!))
    const updated = { ...activeSession, finished_at: finishedAt, duration_seconds: durationSeconds }
    setSessionsByDate(prev => ({
      ...prev,
      [currentDate]: (prev[currentDate] || []).map(s => s.id === activeSession.id ? updated : s),
    }))
    setActiveSession(null)
    await supabase.from('workout_sessions').update({ finished_at: finishedAt, duration_seconds: durationSeconds }).eq('id', activeSession.id)
    toast.success(`Session finished — ${fmtDuration(durationSeconds)}!`)
  }

  async function deleteSession(id: string) {
    if (activeSession?.id === id) setActiveSession(null)
    setSessionsByDate(prev => ({ ...prev, [currentDate]: (prev[currentDate] || []).filter(s => s.id !== id) }))
    await supabase.from('workout_sessions').delete().eq('id', id)
    toast.success('Session deleted')
  }

  async function addExerciseToSession(name: string, muscleGroup: string, isCardio: boolean) {
    if (!activeSession) return
    const exs = exercisesBySession[activeSession.id] || []
    const ex: SessionExercise = {
      id: crypto.randomUUID(), session_id: activeSession.id,
      exercise_name: name, muscle_group: muscleGroup,
      is_cardio: isCardio, position: exs.length,
    }
    setExercisesBySession(prev => ({ ...prev, [activeSession.id]: [...exs, ex] }))
    setSetsByExercise(prev => ({ ...prev, [ex.id]: [] }))
    setExpandedExercise(ex.id)
    await supabase.from('session_exercises').insert({ ...ex, user_id: userId })
    setExModal(false); setManualExName(''); setExResults([])
  }

  async function addSet(exerciseId: string, isCardio: boolean) {
    const exSets = setsByExercise[exerciseId] || []
    const last = exSets[exSets.length - 1]
    const newSet: ExerciseSet = {
      id: crypto.randomUUID(), session_exercise_id: exerciseId,
      set_number: exSets.length + 1, set_type: 'working',
      weight_kg: isCardio ? undefined : (last?.weight_kg ?? undefined),
      reps: isCardio ? undefined : (last?.reps ?? undefined),
      duration_minutes: isCardio ? 0 : undefined, completed: false,
    }
    setSetsByExercise(prev => ({ ...prev, [exerciseId]: [...(prev[exerciseId] || []), newSet] }))
    await supabase.from('exercise_sets').insert({ ...newSet, user_id: userId })
  }

  async function updateSet(setId: string, exerciseId: string, updates: Partial<ExerciseSet>) {
    setSetsByExercise(prev => ({
      ...prev,
      [exerciseId]: (prev[exerciseId] || []).map(s => s.id === setId ? { ...s, ...updates } : s),
    }))
    await supabase.from('exercise_sets').update(updates).eq('id', setId)
  }

  async function deleteSet(setId: string, exerciseId: string) {
    setSetsByExercise(prev => ({ ...prev, [exerciseId]: (prev[exerciseId] || []).filter(s => s.id !== setId) }))
    await supabase.from('exercise_sets').delete().eq('id', setId)
  }

  async function deleteExercise(exId: string) {
    const sessId = activeSession?.id
    if (!sessId) return
    setExercisesBySession(prev => ({ ...prev, [sessId]: (prev[sessId] || []).filter(e => e.id !== exId) }))
    await supabase.from('session_exercises').delete().eq('id', exId)
  }

  async function searchExercisesHandler() {
    setExLoading(true); setExResults([])
    const results = await searchExercises(exQuery, exMuscle || undefined)
    setExResults(results as typeof exResults); setExLoading(false)
  }

  // ── TEMPLATE handlers ─────────────────────────────────────
  async function saveTemplate() {
    if (!templateForm.name.trim()) return
    if (editingTemplate) {
      const updated = { ...editingTemplate, ...templateForm, updated_at: new Date().toISOString() }
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updated : t))
      await supabase.from('workout_templates').update({ name: updated.name, description: updated.description }).eq('id', editingTemplate.id)
      toast.success('Template updated!')
    } else {
      const tpl: WorkoutTemplate = { id: crypto.randomUUID(), user_id: userId, ...templateForm, exercises: [] }
      setTemplates(prev => [...prev, tpl])
      await supabase.from('workout_templates').insert({ id: tpl.id, user_id: userId, name: tpl.name, description: tpl.description })
      setEditingTemplate(tpl)
      toast.success('Template created — add exercises below')
    }
  }

  async function addTemplateExercise() {
    if (!editingTemplate || !templateExForm.name.trim()) return
    const te: TemplateExercise = {
      id: crypto.randomUUID(), template_id: editingTemplate.id,
      exercise_name: templateExForm.name, muscle_group: templateExForm.muscle || undefined,
      is_cardio: templateExForm.is_cardio,
      default_sets: parseInt(templateExForm.sets) || 3,
      default_reps: templateExForm.reps ? parseInt(templateExForm.reps) : undefined,
      default_weight_kg: templateExForm.weight ? parseFloat(templateExForm.weight) : undefined,
      position: editingTemplate.exercises?.length || 0,
    }
    const updated = { ...editingTemplate, exercises: [...(editingTemplate.exercises || []), te] }
    setEditingTemplate(updated)
    setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updated : t))
    await supabase.from('template_exercises').insert({ ...te, user_id: userId })
    setTemplateExForm({ name: '', muscle: '', is_cardio: false, sets: '3', reps: '', weight: '' })
    setTemplateExResults([])
  }

  async function removeTemplateExercise(teId: string) {
    if (!editingTemplate) return
    const updated = { ...editingTemplate, exercises: editingTemplate.exercises?.filter(e => e.id !== teId) }
    setEditingTemplate(updated)
    setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updated : t))
    await supabase.from('template_exercises').delete().eq('id', teId)
  }

  async function deleteTemplate(id: string) {
    setTemplates(prev => prev.filter(t => t.id !== id))
    if (editingTemplate?.id === id) { setEditingTemplate(null) }
    await supabase.from('workout_templates').delete().eq('id', id)
    toast.success('Template deleted')
  }

  async function searchTemplateExercises() {
    if (!templateExForm.name.trim() && !templateExForm.muscle) return
    setTemplateExLoading(true)
    const results = await searchExercises(templateExForm.name, templateExForm.muscle || undefined)
    setTemplateExResults(results as typeof templateExResults); setTemplateExLoading(false)
  }

  // Active session's exercises
  const activeExercises = activeSession ? (exercisesBySession[activeSession.id] || []) : []

  // Finished sessions for current date
  const finishedSessions = sessions.filter(s => s.finished_at)

  // ─────────────────────────────────────────────────────────
  return (
    <div>
      {/* Tab switch */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 p-1 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          {(['nutrition', 'workout'] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab) }}
              className="px-5 py-2 rounded-md text-xs font-medium transition-all"
              style={{ background: activeTab === tab ? 'var(--surface3)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)' }}>
              {tab === 'nutrition' ? '🥗 Nutrition' : '💪 Workout'}
            </button>
          ))}
        </div>

        {/* Shared date navigator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <button onClick={prevDay} style={{ color: 'var(--text-muted)' }}><ChevronLeft size={14} /></button>
          <span className="font-display font-bold text-xs min-w-[120px] text-center">
            {isToday ? 'Today' : format(parseISO(currentDate), 'EEE, MMM d')}
          </span>
          <button onClick={nextDay} style={{ color: 'var(--text-muted)' }}><ChevronRight size={14} /></button>
          {!isToday && (
            <button onClick={goToday} className="text-[10px] px-2 py-0.5 rounded ml-1"
              style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}>Today</button>
          )}
        </div>
      </div>

      {/* ════ NUTRITION TAB ════ */}
      {activeTab === 'nutrition' && (
        <div className="space-y-5">
          {/* Macros */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Calories', val: Math.round(totals.calories), goal: goals.calories, unit: 'kcal', color: 'var(--accent5)' },
              { label: 'Protein',  val: Math.round(totals.protein),  goal: goals.protein,  unit: 'g',    color: 'var(--accent2)' },
              { label: 'Carbs',    val: Math.round(totals.carbs),    goal: goals.carbs,    unit: 'g',    color: 'var(--accent4)' },
              { label: 'Fat',      val: Math.round(totals.fat),      goal: goals.fat,      unit: 'g',    color: 'var(--accent3)' },
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
                      <Bar dataKey="protein" fill="#7b6cfa" name="Protein g" stackId="a" />
                      <Bar dataKey="carbs"   fill="#6cf0fa" name="Carbs g"   stackId="a" />
                      <Bar dataKey="fat"     fill="#fa6c6c" name="Fat g"     stackId="a" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>
            </div>
          )}

          {/* Meals */}
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
            <Button onClick={() => { setGoalsForm(goals); setGoalsModal(true) }}><Settings size={13} /> Edit Goals</Button>
          </div>
        </div>
      )}

      {/* ════ WORKOUT TAB ════ */}
      {activeTab === 'workout' && (
        <div className="space-y-4">
          {/* Active session timer */}
          {activeSession && (
            <div className="space-y-4">
              <SessionTimer startedAt={activeSession.started_at!} onEnd={endSession} />

              {/* Active session exercises */}
              <Card>
                <CardHeader>
                  <span className="font-display font-bold text-base">{activeSession.name}</span>
                  <Button size="sm" variant="accent" onClick={() => setExModal(true)}><Plus size={12} /> Exercise</Button>
                </CardHeader>
                <CardBody className="space-y-3">
                  {activeExercises.map(ex => {
                    const sets = setsByExercise[ex.id] || []
                    const isExpanded = expandedExercise === ex.id
                    return (
                      <div key={ex.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" style={{ background: 'var(--surface2)' }}
                          onClick={() => setExpandedExercise(isExpanded ? null : ex.id)}>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{ex.exercise_name}</div>
                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {ex.muscle_group && `${MUSCLE_ICONS[ex.muscle_group] || '💪'} ${ex.muscle_group} · `}
                              {ex.is_cardio ? '🏃 Cardio' : `${sets.filter(s => s.completed).length}/${sets.length} sets`}
                            </div>
                          </div>
                          <button onClick={e => { e.stopPropagation(); deleteExercise(ex.id) }}
                            className="p-1.5 rounded-lg" style={{ color: 'var(--text-dim)' }}
                            onMouseEnter={e2 => (e2.currentTarget.style.color = 'var(--accent3)')} onMouseLeave={e2 => (e2.currentTarget.style.color = 'var(--text-dim)')}>
                            <Trash2 size={13} />
                          </button>
                          {isExpanded ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
                        </div>
                        {isExpanded && (
                          <div className="px-4 py-3" style={{ background: 'var(--surface)' }}>
                            <div className="grid gap-2 mb-2 text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-dim)', gridTemplateColumns: ex.is_cardio ? '40px 1fr 1fr 1fr 80px 36px' : '40px 120px 1fr 1fr 80px 36px' }}>
                              <span>#</span><span>Type</span>
                              {ex.is_cardio ? <><span>Min</span><span>Dist km</span></> : <><span>Weight kg</span><span>Reps</span></>}
                              <span>Done</span><span />
                            </div>
                            {sets.map(set => (
                              <div key={set.id} className="grid gap-2 mb-2 items-center"
                                style={{ gridTemplateColumns: ex.is_cardio ? '40px 1fr 1fr 1fr 80px 36px' : '40px 120px 1fr 1fr 80px 36px' }}>
                                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{set.set_number}</span>
                                <select value={set.set_type} onChange={e => updateSet(set.id, ex.id, { set_type: e.target.value as ExerciseSet['set_type'] })}
                                  className="px-2 py-1 rounded-md text-[10px] border outline-none cursor-pointer"
                                  style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: SET_TYPES.find(t => t.value === set.set_type)?.color }}>
                                  {SET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                {ex.is_cardio ? (
                                  <>
                                    <input type="number" value={set.duration_minutes ?? ''} placeholder="0"
                                      onChange={e => updateSet(set.id, ex.id, { duration_minutes: parseFloat(e.target.value) || 0 })}
                                      className="px-2 py-1 rounded-md text-xs border outline-none w-full" style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                                    <input type="number" value={set.distance_km ?? ''} placeholder="0"
                                      onChange={e => updateSet(set.id, ex.id, { distance_km: parseFloat(e.target.value) || 0 })}
                                      className="px-2 py-1 rounded-md text-xs border outline-none w-full" style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                                  </>
                                ) : (
                                  <>
                                    <input type="number" value={set.weight_kg ?? ''} placeholder="0"
                                      onChange={e => updateSet(set.id, ex.id, { weight_kg: parseFloat(e.target.value) || 0 })}
                                      className="px-2 py-1 rounded-md text-xs border outline-none w-full" style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                                    <input type="number" value={set.reps ?? ''} placeholder="0"
                                      onChange={e => updateSet(set.id, ex.id, { reps: parseInt(e.target.value) || 0 })}
                                      className="px-2 py-1 rounded-md text-xs border outline-none w-full" style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                                  </>
                                )}
                                <button onClick={() => updateSet(set.id, ex.id, { completed: !set.completed })}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border transition-all"
                                  style={{ borderColor: set.completed ? 'var(--accent)' : 'var(--border)', background: set.completed ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent', color: set.completed ? 'var(--accent)' : 'var(--text-muted)' }}>
                                  {set.completed ? <CheckCircle size={11} /> : <Circle size={11} />}
                                  {set.completed ? 'Done' : 'Mark'}
                                </button>
                                <button onClick={() => deleteSet(set.id, ex.id)} className="p-1 rounded" style={{ color: 'var(--text-dim)' }}
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
                  {activeExercises.length === 0 && (
                    <p className="text-xs text-center py-8" style={{ color: 'var(--text-dim)' }}>No exercises yet — add your first one</p>
                  )}
                </CardBody>
              </Card>
            </div>
          )}

          {/* Finished sessions for this day */}
          {finishedSessions.length > 0 && (
            <div className="space-y-3">
              {!activeSession && (
                <h3 className="font-display font-bold text-sm" style={{ color: 'var(--text-muted)' }}>
                  {isToday ? 'Completed Today' : `Sessions on ${format(parseISO(currentDate), 'MMM d')}`}
                </h3>
              )}
              {activeSession && finishedSessions.length > 0 && (
                <h3 className="font-display font-bold text-sm" style={{ color: 'var(--text-muted)' }}>Completed Sessions</h3>
              )}
              {finishedSessions.map(sess => (
                <SessionCard
                  key={sess.id}
                  session={sess}
                  exercises={exercisesBySession[sess.id] || []}
                  sets={(exercisesBySession[sess.id] || []).flatMap(ex => setsByExercise[ex.id] || [])}
                  onDelete={() => deleteSession(sess.id)}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!activeSession && finishedSessions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <Dumbbell size={36} className="mb-4" style={{ color: 'var(--text-dim)' }} />
              <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
                {isToday ? 'No session started today' : `No sessions on ${format(parseISO(currentDate), 'MMM d')}`}
              </p>
              {isToday && <p className="text-xs mb-6" style={{ color: 'var(--text-dim)' }}>Start a session or use a template</p>}
              {isToday && (
                <div className="flex gap-3">
                  <Button onClick={() => { loadTemplates(); setStartModal(true) }}>
                    <LayoutTemplate size={13} /> Use Template
                  </Button>
                  <Button variant="accent" onClick={() => { setSessionForm({ name: 'Workout', notes: '', template_id: '' }); setStartModal(true) }}>
                    <Play size={13} /> Start Session
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Start new session button (when sessions exist or active) */}
          {isToday && (activeSession || finishedSessions.length > 0) && !activeSession && (
            <Button variant="accent" onClick={() => { loadTemplates(); setStartModal(true) }} className="w-full">
              <Plus size={13} /> Start Another Session
            </Button>
          )}
          {isToday && finishedSessions.length > 0 && !activeSession && (
            <div />
          )}
          {isToday && activeSession && (
            <Button onClick={() => { loadTemplates(); setStartModal(true) }} className="w-full">
              <Plus size={13} /> Start Another Session
            </Button>
          )}

          {/* Template manager link */}
          <div className="flex justify-end">
            <Button onClick={() => { loadTemplates(); setTemplateModal(true) }}>
              <LayoutTemplate size={13} /> Manage Templates
            </Button>
          </div>
        </div>
      )}

      {/* ════ MODALS ════ */}

      {/* Start Session Modal */}
      <Modal open={startModal} onClose={() => setStartModal(false)} title="Start Workout Session">
        <div className="space-y-4">
          <Input label="Session Name" placeholder="e.g. Push Day, Chest & Triceps..." value={sessionForm.name}
            onChange={e => setSessionForm(p => ({ ...p, name: e.target.value }))} />

          {templates.length > 0 && (
            <div>
              <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Template (optional)
              </label>
              <select value={sessionForm.template_id} onChange={e => {
                const tpl = templates.find(t => t.id === e.target.value)
                setSessionForm(p => ({ ...p, template_id: e.target.value, name: tpl?.name || p.name }))
              }}
                className="w-full px-3 py-2.5 rounded-lg text-xs border outline-none cursor-pointer"
                style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value="">— No template (blank session) —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.exercises?.length || 0} exercises)
                  </option>
                ))}
              </select>
            </div>
          )}

          {sessionForm.template_id && (
            <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--surface2)' }}>
              {templates.find(t => t.id === sessionForm.template_id)?.exercises?.map(ex => (
                <div key={ex.id} className="text-xs py-1 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <span>{MUSCLE_ICONS[ex.muscle_group || ''] || '💪'}</span>
                  <span>{ex.exercise_name}</span>
                  <span style={{ color: 'var(--text-dim)' }}>{ex.default_sets}×{ex.default_reps || '?'}</span>
                </div>
              ))}
            </div>
          )}

          <Input label="Notes (optional)" placeholder="Focus, goals..." value={sessionForm.notes}
            onChange={e => setSessionForm(p => ({ ...p, notes: e.target.value }))} />

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setStartModal(false)}>Cancel</Button>
            <Button variant="accent" onClick={createSession}><Play size={13} /> Start</Button>
          </div>
        </div>
      </Modal>

      {/* Template Manager Modal */}
      <Modal open={templateModal} onClose={() => { setTemplateModal(false); setEditingTemplate(null) }} title="Workout Templates" width="max-w-2xl">
        <div className="grid grid-cols-2 gap-4 min-h-[400px]">
          {/* Template list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Your Templates</span>
              <Button size="sm" variant="accent" onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', description: '' }) }}>
                <Plus size={11} /> New
              </Button>
            </div>

            {templates.length === 0 && (
              <p className="text-xs text-center py-8" style={{ color: 'var(--text-dim)' }}>No templates yet</p>
            )}

            {templates.map(tpl => (
              <div key={tpl.id}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all"
                style={{
                  background: editingTemplate?.id === tpl.id ? 'var(--surface2)' : 'var(--surface)',
                  borderColor: editingTemplate?.id === tpl.id ? 'var(--accent)' : 'var(--border)',
                }}
                onClick={() => { setEditingTemplate(tpl); setTemplateForm({ name: tpl.name, description: tpl.description || '' }) }}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{tpl.name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {tpl.exercises?.length || 0} exercises
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); deleteTemplate(tpl.id) }}
                  className="opacity-0 group-hover:opacity-100 p-1 transition-opacity" style={{ color: 'var(--text-dim)' }}
                  onMouseEnter={e2 => (e2.currentTarget.style.color = 'var(--accent3)')} onMouseLeave={e2 => (e2.currentTarget.style.color = 'var(--text-dim)')}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Template editor */}
          <div className="border-l pl-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {editingTemplate ? `Editing: ${editingTemplate.name}` : 'New Template'}
            </p>

            <Input placeholder="Template name..." value={templateForm.name}
              onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))} />
            <Input placeholder="Description (optional)" value={templateForm.description}
              onChange={e => setTemplateForm(p => ({ ...p, description: e.target.value }))} />
            <Button size="sm" variant="accent" onClick={saveTemplate} className="w-full">
              {editingTemplate ? 'Update Name' : 'Create Template'}
            </Button>

            {editingTemplate && (
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Exercises</p>

                {editingTemplate.exercises?.map(te => (
                  <div key={te.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs"
                    style={{ background: 'var(--surface2)' }}>
                    <span className="flex-1 truncate">{te.exercise_name}</span>
                    <span style={{ color: 'var(--text-dim)' }}>{te.default_sets}×{te.default_reps || '?'}</span>
                    <button onClick={() => removeTemplateExercise(te.id)} style={{ color: 'var(--text-dim)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent3)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>
                      <X size={11} />
                    </button>
                  </div>
                ))}

                {/* Add exercise to template */}
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <input value={templateExForm.name} onChange={e => setTemplateExForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Exercise name..."
                      className="flex-1 px-2 py-1.5 rounded-lg text-xs border outline-none"
                      style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                      onKeyDown={e => e.key === 'Enter' && searchTemplateExercises()} />
                    <button onClick={searchTemplateExercises} disabled={templateExLoading}
                      className="px-2 py-1.5 rounded-lg border text-xs"
                      style={{ background: 'var(--accent)', color: '#0e0e10', borderColor: 'var(--accent)' }}>
                      {templateExLoading ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
                    </button>
                  </div>

                  {templateExResults.length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {templateExResults.map((ex, i) => (
                        <button key={i} onClick={() => setTemplateExForm(p => ({ ...p, name: ex.name, muscle: ex.muscle }))}
                          className="w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all"
                          style={{ background: templateExForm.name === ex.name ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface3)' }}>
                          <span className="font-medium capitalize">{ex.name}</span>
                          <span className="ml-2" style={{ color: 'var(--text-muted)' }}>{ex.muscle}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-1">
                    <input value={templateExForm.sets} onChange={e => setTemplateExForm(p => ({ ...p, sets: e.target.value }))}
                      placeholder="Sets" type="number"
                      className="px-2 py-1.5 rounded-lg text-xs border outline-none"
                      style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                    <input value={templateExForm.reps} onChange={e => setTemplateExForm(p => ({ ...p, reps: e.target.value }))}
                      placeholder="Reps" type="number"
                      className="px-2 py-1.5 rounded-lg text-xs border outline-none"
                      style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                    <input value={templateExForm.weight} onChange={e => setTemplateExForm(p => ({ ...p, weight: e.target.value }))}
                      placeholder="kg" type="number"
                      className="px-2 py-1.5 rounded-lg text-xs border outline-none"
                      style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  </div>

                  <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                    <input type="checkbox" checked={templateExForm.is_cardio} onChange={e => setTemplateExForm(p => ({ ...p, is_cardio: e.target.checked }))} />
                    Cardio exercise
                  </label>

                  <Button size="sm" onClick={addTemplateExercise} className="w-full" disabled={!templateExForm.name.trim()}>
                    <Plus size={11} /> Add Exercise
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Exercise Search Modal (for active session) */}
      <Modal open={exModal} onClose={() => setExModal(false)} title="Add Exercise" width="max-w-xl">
        <div className="space-y-4">
          <div className="p-3 rounded-lg border space-y-3" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Add Manually</p>
            <div className="flex gap-2">
              <Input placeholder="Exercise name..." value={manualExName} onChange={e => setManualExName(e.target.value)} className="flex-1" />
              <label className="flex items-center gap-2 text-xs cursor-pointer px-3 py-2 rounded-lg border whitespace-nowrap"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: manualExCardio ? 'color-mix(in srgb, var(--accent4) 15%, transparent)' : 'transparent' }}>
                <input type="checkbox" checked={manualExCardio} onChange={e => setManualExCardio(e.target.checked)} />
                Cardio
              </label>
              <Button variant="accent" onClick={() => manualExName.trim() && addExerciseToSession(manualExName, '', manualExCardio)}>Add</Button>
            </div>
          </div>
          <div className="p-3 rounded-lg border space-y-3" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Search Database</p>
            <div className="flex gap-2">
              <Input placeholder="Exercise name..." value={exQuery} onChange={e => setExQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchExercisesHandler()} className="flex-1" />
              <select value={exMuscle} onChange={e => setExMuscle(e.target.value)}
                className="px-3 py-2 rounded-lg text-xs border outline-none"
                style={{ background: 'var(--surface3)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value="">All</option>
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
            </div>
          </div>
        </div>
      </Modal>

      {/* Food Modal */}
      <Modal open={foodModal} onClose={() => setFoodModal(false)} title={`Log Food — ${foodMeal}`} width="max-w-xl">
        <div className="space-y-4">
          <Select label="Meal" value={foodMeal} onChange={e => setFoodMeal(e.target.value as MealType)}
            options={MEALS.map(m => ({ value: m, label: m }))} />
          <div className="flex gap-1 p-1 rounded-lg border" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
            {(['search', 'library', 'custom'] as const).map(t => (
              <button key={t} onClick={() => { setFoodTab(t); if (t === 'library') loadCustomFoods() }}
                className="flex-1 py-1.5 rounded-md text-[10px] transition-all font-medium"
                style={{ background: foodTab === t ? 'var(--surface3)' : 'transparent', color: foodTab === t ? 'var(--accent)' : 'var(--text-muted)' }}>
                {t === 'search' ? '🔍 Search DB' : t === 'library' ? '📚 My Library' : '➕ Create New'}
              </button>
            ))}
          </div>

          {foodTab === 'search' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Search Open Food Facts..." value={foodQuery}
                  onChange={e => setFoodQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchFoodHandler()} className="flex-1" />
                <Button onClick={searchFoodHandler} disabled={foodLoading} variant="accent">
                  {foodLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                </Button>
              </div>
              {foodSearchError && <p className="text-xs" style={{ color: 'var(--accent3)' }}>⚠ API unavailable — use My Library or Create New.</p>}
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
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>= {calcNutrition(selectedFood as Parameters<typeof calcNutrition>[0], parseFloat(grams) || 100).calories} kcal</span>
                  <Button variant="accent" onClick={logSearchFood}>Log</Button>
                </div>
              )}
            </div>
          )}

          {foodTab === 'library' && (
            <div className="space-y-2">
              {customFoods.length === 0
                ? <p className="text-xs text-center py-6" style={{ color: 'var(--text-dim)' }}>No saved foods — create one in the next tab</p>
                : (
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
                    <div className="flex-1 pt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {customFoodPreview && `${customFoodPreview.calories} kcal · ${customFoodPreview.protein}g P · ${customFoodPreview.carbs}g C · ${customFoodPreview.fat}g F`}
                    </div>
                  </div>
                  <Button variant="accent" onClick={logCustomFood} className="w-full">Log {selectedCustomFood.name}</Button>
                </div>
              )}
            </div>
          )}

          {foodTab === 'custom' && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enter macros per 100g. Saved to your library.</p>
              <Input label="Food Name" placeholder="e.g. Homemade Protein Shake" value={newCustomFood.name}
                onChange={e => setNewCustomFood(p => ({ ...p, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Calories (kcal/100g)" type="number" value={newCustomFood.calories_100g} onChange={e => setNewCustomFood(p => ({ ...p, calories_100g: e.target.value }))} />
                <Input label="Protein (g/100g)"     type="number" value={newCustomFood.protein_100g}  onChange={e => setNewCustomFood(p => ({ ...p, protein_100g: e.target.value }))} />
                <Input label="Carbs (g/100g)"       type="number" value={newCustomFood.carbs_100g}    onChange={e => setNewCustomFood(p => ({ ...p, carbs_100g: e.target.value }))} />
                <Input label="Fat (g/100g)"         type="number" value={newCustomFood.fat_100g}      onChange={e => setNewCustomFood(p => ({ ...p, fat_100g: e.target.value }))} />
              </div>
              <Button variant="accent" onClick={saveCustomFood} className="w-full">Save to Library</Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Goals Modal */}
      <Modal open={goalsModal} onClose={() => setGoalsModal(false)} title="Nutrition Goals">
        <div className="space-y-4">
          <Input label="Daily Calories (kcal)" type="number" value={String(goalsForm.calories)} onChange={e => setGoalsForm(p => ({ ...p, calories: parseInt(e.target.value) || 0 }))} />
          <Input label="Protein Goal (g)"      type="number" value={String(goalsForm.protein)}  onChange={e => setGoalsForm(p => ({ ...p, protein:  parseInt(e.target.value) || 0 }))} />
          <Input label="Carbs Goal (g)"        type="number" value={String(goalsForm.carbs)}    onChange={e => setGoalsForm(p => ({ ...p, carbs:    parseInt(e.target.value) || 0 }))} />
          <Input label="Fat Goal (g)"          type="number" value={String(goalsForm.fat)}      onChange={e => setGoalsForm(p => ({ ...p, fat:      parseInt(e.target.value) || 0 }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setGoalsModal(false)}>Cancel</Button>
            <Button variant="accent" onClick={saveGoals}>Save Goals</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
