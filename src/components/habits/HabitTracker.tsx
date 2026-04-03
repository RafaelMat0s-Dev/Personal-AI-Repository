'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Habit, HabitLog } from '@/types'
import { getDaysInMonth, cn } from '@/lib/utils'
import { Button, Modal, Input, Card, CardHeader, CardBody } from '@/components/ui'
import { ChevronLeft, ChevronRight, Flame, Plus, Trash2 } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import toast from 'react-hot-toast'

function getStreak(habitId: string, logs: HabitLog[], year: number, month: number, upToDay: number): number {
  let streak = 0
  for (let d = upToDay; d >= 1; d--) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (logs.some(l => l.habit_id === habitId && l.date === dateStr && l.done)) streak++
    else break
  }
  return streak
}

export default function HabitTracker({ initialHabits, initialLogs, userId }: {
  initialHabits: Habit[]
  initialLogs: HabitLog[]
  userId: string
}) {
  const [habits, setHabits] = useState<Habit[]>(initialHabits)
  const [logs, setLogs] = useState<HabitLog[]>(initialLogs)
  const [viewMonth, setViewMonth] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', emoji: '' })
  const supabase = createClient()

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayDay = new Date().getDate()
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth()

  async function loadLogs(date: Date) {
    const start = format(new Date(date.getFullYear(), date.getMonth(), 1), 'yyyy-MM-dd')
    const end = format(new Date(date.getFullYear(), date.getMonth() + 1, 0), 'yyyy-MM-dd')
    const { data } = await supabase.from('habit_logs').select('*').eq('user_id', userId).gte('date', start).lte('date', end)
    setLogs(data || [])
  }

  async function changeMonth(delta: number) {
    const next = delta > 0 ? addMonths(viewMonth, 1) : subMonths(viewMonth, 1)
    setViewMonth(next)
    await loadLogs(next)
  }

  async function toggleHabit(habitId: string, day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const existing = logs.find(l => l.habit_id === habitId && l.date === dateStr)

    if (existing) {
      setLogs(prev => prev.filter(l => !(l.habit_id === habitId && l.date === dateStr)))
      await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', dateStr)
    } else {
      const newLog: HabitLog = { id: crypto.randomUUID(), habit_id: habitId, date: dateStr, done: true }
      setLogs(prev => [...prev, newLog])
      await supabase.from('habit_logs').upsert({ ...newLog, user_id: userId })
    }
  }

  async function addHabit() {
    if (!form.name.trim()) return
    const newHabit: Habit = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: form.name,
      emoji: form.emoji || '●',
      color: 'var(--accent)',
      position: habits.length,
      created_at: new Date().toISOString(),
    }
    setHabits(prev => [...prev, newHabit])
    setModalOpen(false)
    setForm({ name: '', emoji: '' })
    const { error } = await supabase.from('habits').insert(newHabit)
    if (error) toast.error('Failed to save habit')
    else toast.success('Habit added!')
  }

  async function deleteHabit(id: string) {
    setHabits(prev => prev.filter(h => h.id !== id))
    await supabase.from('habits').delete().eq('id', id)
  }

  // Completion stats
  const totalCells = habits.length * (isCurrentMonth ? todayDay : daysInMonth)
  const doneCells = logs.filter(l => l.done).length
  const pct = totalCells > 0 ? Math.round(doneCells / totalCells * 100) : 0

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <button onClick={() => changeMonth(-1)} className="transition-colors p-0.5 rounded"
            style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={16} />
          </button>
          <span className="font-display font-bold text-sm min-w-[130px] text-center">
            {format(viewMonth, 'MMMM yyyy')}
          </span>
          <button onClick={() => changeMonth(1)} className="transition-colors p-0.5 rounded"
            style={{ color: 'var(--text-muted)' }}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs px-3 py-2 rounded-lg border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <span className="font-display font-bold text-base" style={{ color: 'var(--accent)' }}>{pct}%</span>
            <span className="ml-1.5">completion</span>
          </div>
          <Button variant="accent" onClick={() => setModalOpen(true)}>
            <Plus size={13} /> Add Habit
          </Button>
        </div>
      </div>

      {/* Grid */}
      <Card>
        <CardHeader>
          <span className="font-display font-bold text-sm">Monthly Grid</span>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Flame size={13} style={{ color: 'var(--accent5)' }} />
            Streaks shown per habit
          </div>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: `${Math.max(600, daysInMonth * 30 + 200)}px` }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-5 py-3 text-[9px] tracking-[2px] uppercase sticky left-0 z-10"
                  style={{ color: 'var(--text-dim)', background: 'var(--surface)', minWidth: '180px' }}>Habit</th>
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <th key={i + 1} className="text-center py-3 text-[10px]"
                    style={{
                      color: isCurrentMonth && i + 1 === todayDay ? 'var(--accent)' : 'var(--text-muted)',
                      minWidth: '30px',
                      fontWeight: isCurrentMonth && i + 1 === todayDay ? 700 : 400,
                    }}>
                    {i + 1}
                  </th>
                ))}
                <th className="text-left pl-4 py-3 text-[9px] tracking-[2px] uppercase"
                  style={{ color: 'var(--text-dim)', minWidth: '80px' }}>Streak</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {habits.map(habit => {
                const streak = getStreak(habit.id, logs, year, month, isCurrentMonth ? todayDay : daysInMonth)
                return (
                  <tr key={habit.id} className="group" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="sticky left-0 z-10 px-5 py-2.5"
                      style={{ background: 'var(--surface)' }}>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-base">{habit.emoji}</span>
                        <span className="font-medium">{habit.name}</span>
                      </div>
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const isFuture = isCurrentMonth && dateStr > todayStr
                      const isDone = logs.some(l => l.habit_id === habit.id && l.date === dateStr && l.done)
                      return (
                        <td key={day} className="text-center py-2.5">
                          <button
                            onClick={() => !isFuture && toggleHabit(habit.id, day)}
                            disabled={isFuture}
                            className={cn(
                              'w-[22px] h-[22px] rounded-md border mx-auto flex items-center justify-center text-[10px] transition-all',
                              isDone ? 'border-0 scale-105' : 'hover:border-[var(--text-dim)]',
                              isFuture ? 'opacity-20 cursor-default' : 'cursor-pointer hover:scale-110'
                            )}
                            style={{
                              background: isDone ? 'var(--accent)' : 'var(--surface2)',
                              borderColor: 'var(--border)',
                              color: isDone ? '#0e0e10' : 'transparent',
                            }}
                          >
                            {isDone && '✓'}
                          </button>
                        </td>
                      )
                    })}
                    <td className="pl-4 py-2.5">
                      <span className="text-xs font-medium" style={{ color: streak > 0 ? 'var(--accent5)' : 'var(--text-dim)' }}>
                        {streak > 0 ? `🔥 ${streak}` : '—'}
                      </span>
                    </td>
                    <td className="pr-3">
                      <button onClick={() => deleteHabit(habit.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                        style={{ color: 'var(--text-dim)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent3)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td colSpan={daysInMonth + 3} className="px-5 py-3">
                  <button onClick={() => setModalOpen(true)}
                    className="text-xs w-full text-left border border-dashed rounded-lg px-4 py-2 transition-all"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}>
                    + Add new habit...
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Habit">
        <div className="space-y-4">
          <Input label="Habit Name" placeholder="e.g. Morning workout" value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addHabit()} />
          <Input label="Emoji Icon" placeholder="e.g. 🏃" value={form.emoji}
            onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))} maxLength={4} />
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={addHabit}>Add Habit</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
