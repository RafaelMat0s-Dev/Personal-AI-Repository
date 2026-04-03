'use client'

import { useMemo } from 'react'
import { Task, Habit, HabitLog, FoodLog, WorkoutLog } from '@/types'
import { Card, CardHeader, CardBody } from '@/components/ui'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, eachDayOfInterval, parseISO, subDays } from 'date-fns'

interface Props {
  tasks: Task[]
  habits: Pick<Habit, 'id' | 'name'>[]
  habitLogs: HabitLog[]
  foodLogs: Pick<FoodLog, 'date' | 'calories' | 'protein'>[]
  workoutLogs: WorkoutLog[]
  workoutPlanCount: number
  thirtyDaysAgo: string
  today: string
}

const CHART_COLORS = {
  calories: '#fac86c',
  protein: '#7b6cfa',
  habits: '#c8fa5f',
  workouts: '#6cf0fa',
}

export default function AnalyticsClient({
  tasks, habits, habitLogs, foodLogs, workoutLogs, workoutPlanCount, thirtyDaysAgo, today
}: Props) {

  // 30-day daily data
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: parseISO(thirtyDaysAgo), end: parseISO(today) })
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const dayFood = foodLogs.filter(f => f.date === dateStr)
      const habitsDone = habitLogs.filter(l => l.date === dateStr && l.done).length
      const habitsPct = habits.length > 0 ? Math.round(habitsDone / habits.length * 100) : 0
      const workoutsDone = workoutLogs.filter(l => l.date === dateStr && l.completed).length
      return {
        date: format(day, 'MMM d'),
        calories: dayFood.reduce((s, f) => s + f.calories, 0),
        protein: Math.round(dayFood.reduce((s, f) => s + f.protein, 0)),
        habitsPercent: habitsPct,
        workouts: workoutsDone,
      }
    })
  }, [foodLogs, habitLogs, habits, workoutLogs, thirtyDaysAgo, today])

  // Task distribution
  const taskDistribution = useMemo(() => {
    const cols = ['backlog', 'todo', 'inprogress', 'done']
    const colors = ['var(--text-dim)', 'var(--accent4)', 'var(--accent5)', 'var(--accent)']
    return cols.map((c, i) => ({
      name: c === 'inprogress' ? 'In Progress' : c.charAt(0).toUpperCase() + c.slice(1),
      value: tasks.filter(t => t.column_id === c).length,
      color: colors[i],
    })).filter(d => d.value > 0)
  }, [tasks])

  // Tag distribution
  const tagDistribution = useMemo(() => {
    const tagMap: Record<string, number> = {}
    tasks.forEach(t => { tagMap[t.tag] = (tagMap[t.tag] || 0) + 1 })
    const colors: Record<string, string> = {
      work: 'var(--accent2)', personal: 'var(--accent)', health: 'var(--accent3)',
      study: 'var(--accent4)', misc: 'var(--accent5)',
    }
    return Object.entries(tagMap).map(([k, v]) => ({ name: k, value: v, color: colors[k] || 'var(--text-muted)' }))
  }, [tasks])

  // Summary stats
  const avgCals = dailyData.length > 0
    ? Math.round(dailyData.filter(d => d.calories > 0).reduce((s, d) => s + d.calories, 0) / (dailyData.filter(d => d.calories > 0).length || 1))
    : 0
  const avgHabits = dailyData.length > 0
    ? Math.round(dailyData.reduce((s, d) => s + d.habitsPercent, 0) / dailyData.length)
    : 0
  const totalWorkouts = workoutLogs.filter(l => l.completed).length
  const tasksDone = tasks.filter(t => t.column_id === 'done').length

  const tooltipStyle = {
    contentStyle: {
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: '8px', fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: 'var(--text)',
    },
    labelStyle: { color: 'var(--text-muted)', fontSize: '10px' },
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '30d Avg Calories', value: avgCals, unit: 'kcal', color: 'var(--accent5)' },
          { label: 'Avg Habit Rate', value: `${avgHabits}%`, color: 'var(--accent)' },
          { label: 'Workouts Done', value: totalWorkouts, color: 'var(--accent4)' },
          { label: 'Tasks Completed', value: tasksDone, color: 'var(--accent2)' },
        ].map(s => (
          <Card key={s.label}>
            <CardBody className="py-4">
              <div className="text-[10px] tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
              <div className="font-display font-extrabold text-2xl" style={{ color: s.color }}>
                {s.value}{s.unit && <span className="text-sm font-mono font-normal ml-1">{s.unit}</span>}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Calorie + Protein chart */}
      <Card>
        <CardHeader>
          <span className="font-display font-bold text-sm">Nutrition — Last 30 Days</span>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gradCal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.calories} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.calories} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.protein} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.protein} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false}
                interval={Math.floor(dailyData.length / 6)} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="calories" stroke={CHART_COLORS.calories} fill="url(#gradCal)" strokeWidth={2} dot={false} name="Calories" />
              <Area type="monotone" dataKey="protein" stroke={CHART_COLORS.protein} fill="url(#gradPro)" strokeWidth={2} dot={false} name="Protein (g)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Habit completion chart */}
        <Card>
          <CardHeader>
            <span className="font-display font-bold text-sm">Habit Completion %</span>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dailyData.slice(-14)} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, 'Completion']} />
                <Bar dataKey="habitsPercent" fill={CHART_COLORS.habits} radius={[4, 4, 0, 0]} name="Habits %" />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Task distribution pie */}
        <Card>
          <CardHeader>
            <span className="font-display font-bold text-sm">Task Distribution</span>
          </CardHeader>
          <CardBody className="flex items-center justify-center">
            {taskDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={taskDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                    dataKey="value" paddingAngle={3}>
                    {taskDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px', fontFamily: 'var(--font-dm-mono)', color: 'var(--text)' }} />
                  <Legend formatter={(v) => <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No tasks yet</p>
            )}
          </CardBody>
        </Card>

        {/* Workout frequency */}
        <Card>
          <CardHeader>
            <span className="font-display font-bold text-sm">Workout Frequency</span>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dailyData.slice(-14)} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="workouts" fill={CHART_COLORS.workouts} radius={[4, 4, 0, 0]} name="Exercises Done" />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Tag distribution */}
        <Card>
          <CardHeader>
            <span className="font-display font-bold text-sm">Task Tags</span>
          </CardHeader>
          <CardBody className="flex items-center justify-center">
            {tagDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={tagDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                    dataKey="value" paddingAngle={3}>
                    {tagDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px', fontFamily: 'var(--font-dm-mono)', color: 'var(--text)' }} />
                  <Legend formatter={(v) => <span style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'capitalize' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No tasks yet</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
