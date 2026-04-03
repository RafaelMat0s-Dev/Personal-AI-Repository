// ─── Auth ───────────────────────────────────────────────────
export interface Profile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
}

// ─── Kanban ─────────────────────────────────────────────────
export type ColumnId = 'backlog' | 'todo' | 'inprogress' | 'done'
export type ViewType = 'weekly' | 'daily'
export type Priority = 'high' | 'mid' | 'low'
export type Tag = 'work' | 'personal' | 'health' | 'study' | 'misc'

export interface Task {
  id: string
  user_id: string
  text: string
  column_id: ColumnId
  view_type: ViewType
  tag: Tag
  priority: Priority
  due_date?: string
  position: number
  created_at: string
  updated_at: string
}

// ─── Habits ─────────────────────────────────────────────────
export interface Habit {
  id: string
  user_id: string
  name: string
  emoji: string
  color: string
  position: number
  created_at: string
}

export interface HabitLog {
  id: string
  habit_id: string
  date: string
  done: boolean
}

// ─── Notes ──────────────────────────────────────────────────
export type NoteCategory = 'study' | 'math' | 'science' | 'language' | 'coding' | 'other'

export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  category: NoteCategory
  tags: string[]
  pinned: boolean
  created_at: string
  updated_at: string
}

// ─── Nutrition ──────────────────────────────────────────────
export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks'

export interface NutritionGoals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface FoodLog {
  id: string
  user_id: string
  date: string
  meal: MealType
  food_name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  serving_size?: string
  created_at: string
}

// Open Food Facts
export interface FoodSearchResult {
  product_name: string
  brands?: string
  nutriments: {
    'energy-kcal_100g'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
  }
  serving_size?: string
}

// ─── Workout ────────────────────────────────────────────────
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export interface WorkoutPlan {
  id: string
  user_id: string
  day_of_week: DayOfWeek
  exercise_name: string
  sets_reps: string
  muscle_group?: string
  position: number
  created_at: string
}

export interface WorkoutLog {
  id: string
  plan_id: string
  date: string
  completed: boolean
  notes?: string
}

// API Ninjas Exercise
export interface ExerciseResult {
  name: string
  muscle: string
  equipment: string
  difficulty: string
  instructions: string
  type: string
}

// ─── Calendar ───────────────────────────────────────────────
export type EventType = 'event' | 'reminder' | 'workout' | 'goal'

export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  description?: string
  date: string
  time?: string
  end_time?: string
  type: EventType
  color: string
  created_at: string
}

// ─── Analytics ──────────────────────────────────────────────
export interface WeeklyStats {
  week: string
  tasksCompleted: number
  habitsCompleted: number
  workoutsCompleted: number
  avgCalories: number
  avgProtein: number
}

// ─── Custom Food Library ────────────────────────────────────
export interface CustomFood {
  id: string
  user_id: string
  name: string
  calories_100g: number
  protein_100g: number
  carbs_100g: number
  fat_100g: number
  created_at: string
}

// ─── Workout Sessions ───────────────────────────────────────
export interface WorkoutSession {
  id: string
  user_id: string
  date: string
  name: string
  notes?: string
  created_at?: string
}

export interface SessionExercise {
  id: string
  session_id: string
  user_id: string
  exercise_name: string
  muscle_group?: string
  is_cardio: boolean
  position: number
  created_at?: string
}

export type SetType = 'working' | 'warmup' | 'dropset'

export interface ExerciseSet {
  id: string
  session_exercise_id: string
  user_id: string
  set_number: number
  set_type: SetType
  weight_kg?: number
  reps?: number
  duration_minutes?: number
  distance_km?: number
  completed: boolean
  created_at?: string
}

// ─── Calendar Blocks ────────────────────────────────────────
export interface CalendarBlock {
  id: string
  user_id: string
  date: string
  name: string
  color: string
  start_time: string
  end_time: string
  task_ids: string[]
  created_at?: string
}
