'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardBody, Button, Modal, Input } from '@/components/ui'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid
} from 'recharts'
import { Plus, Trash2, TrendingDown, TrendingUp, Minus, Target, Scale } from 'lucide-react'
import { format, subDays, differenceInDays, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

interface WeightLog {
  id: string
  user_id: string
  date: string
  weight_kg: number
  body_fat_pct?: number
  notes?: string
  created_at: string
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: '8px', fontFamily: 'var(--font-dm-mono)',
    fontSize: '11px', color: 'var(--text)',
  },
  labelStyle: { color: 'var(--text-muted)', fontSize: '10px' },
}

const RANGE_OPTIONS = [
  { label: '2W', days: 14 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 0 },
]

function movingAverage(data: { weight_kg: number }[], window = 7): number[] {
  return data.map((_, i) => {
    const start = Math.max(0, i - Math.floor(window / 2))
    const end = Math.min(data.length, i + Math.ceil(window / 2))
    const slice = data.slice(start, end)
    return slice.reduce((s, d) => s + d.weight_kg, 0) / slice.length
  })
}

export default function WeightClient({ initialLogs, userId }: { initialLogs: WeightLog[]; userId: string }) {
  const supabase = createClient()
  const [logs, setLogs] = useState<WeightLog[]>(initialLogs)
  const [range, setRange] = useState(30)
  const [modalOpen, setModalOpen] = useState(false)
  const [goalModal, setGoalModal] = useState(false)
  const [goalWeight, setGoalWeight] = useState('')
  const [savedGoal, setSavedGoal] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('weight_goal')
      return v ? parseFloat(v) : null
    }
    return null
  })
  const [unitKg, setUnitKg] = useState(true)
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    weight_kg: '',
    body_fat_pct: '',
    notes: '',
  })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function toDisplay(kg: number) {
    return unitKg ? kg : parseFloat((kg * 2.20462).toFixed(1))
  }
  function toKg(val: number) {
    return unitKg ? val : val / 2.20462
  }
  const unit = unitKg ? 'kg' : 'lbs'

  // Filter by range
  const filtered = useMemo(() => {
    if (range === 0) return logs
    const cutoff = format(subDays(new Date(), range), 'yyyy-MM-dd')
    return logs.filter(l => l.date >= cutoff)
  }, [logs, range])

  // Chart data with moving average
  const chartData = useMemo(() => {
    const ma = movingAverage(filtered)
    return filtered.map((l, i) => ({
      date: l.date.slice(5), // MM-DD
      fullDate: l.date,
      weight: parseFloat(toDisplay(l.weight_kg).toFixed(2)),
      avg: parseFloat(toDisplay(ma[i]).toFixed(2)),
      body_fat: l.body_fat_pct ?? null,
    }))
  }, [filtered, unitKg])

  // Stats
  const stats = useMemo(() => {
    if (filtered.length === 0) return null
    const weights = filtered.map(l => l.weight_kg)
    const latest = weights[weights.length - 1]
    const first = weights[0]
    const min = Math.min(...weights)
    const max = Math.max(...weights)
    const change = latest - first
    const daysSpan = filtered.length > 1
      ? differenceInDays(parseISO(filtered[filtered.length - 1].date), parseISO(filtered[0].date))
      : 0
    const weeklyRate = daysSpan > 0 ? (change / daysSpan) * 7 : 0
    return { latest, first, min, max, change, weeklyRate }
  }, [filtered])

  const latestLog = logs[logs.length - 1]

  async function addLog() {
    if (!form.weight_kg || !form.date) return
    const weightKg = parseFloat(unitKg ? form.weight_kg : String(toKg(parseFloat(form.weight_kg))))
    if (isNaN(weightKg)) return

    // Check if entry for this date exists — if so update
    const existing = logs.find(l => l.date === form.date)
    if (existing) {
      const updated = {
        ...existing,
        weight_kg: parseFloat(weightKg.toFixed(2)),
        body_fat_pct: form.body_fat_pct ? parseFloat(form.body_fat_pct) : undefined,
        notes: form.notes || undefined,
      }
      setLogs(prev => prev.map(l => l.date === form.date ? updated : l).sort((a, b) => a.date.localeCompare(b.date)))
      await supabase.from('weight_logs').update({
        weight_kg: updated.weight_kg,
        body_fat_pct: updated.body_fat_pct ?? null,
        notes: updated.notes ?? null,
      }).eq('id', existing.id)
      toast.success('Entry updated!')
    } else {
      const log: WeightLog = {
        id: crypto.randomUUID(), user_id: userId,
        date: form.date,
        weight_kg: parseFloat(weightKg.toFixed(2)),
        body_fat_pct: form.body_fat_pct ? parseFloat(form.body_fat_pct) : undefined,
        notes: form.notes || undefined,
        created_at: new Date().toISOString(),
      }
      setLogs(prev => [...prev, log].sort((a, b) => a.date.localeCompare(b.date)))
      await supabase.from('weight_logs').insert(log)
      toast.success('Weight logged!')
    }
    setModalOpen(false)
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), weight_kg: '', body_fat_pct: '', notes: '' })
  }

  async function deleteLog(id: string) {
    setLogs(prev => prev.filter(l => l.id !== id))
    await supabase.from('weight_logs').delete().eq('id', id)
    setDeleteId(null)
    toast.success('Entry deleted')
  }

  function saveGoal() {
    const g = parseFloat(goalWeight)
    if (isNaN(g)) return
    const gKg = unitKg ? g : toKg(g)
    setSavedGoal(gKg)
    localStorage.setItem('weight_goal', String(gKg))
    setGoalModal(false)
    setGoalWeight('')
    toast.success('Goal saved!')
  }

  const goalDisplay = savedGoal ? toDisplay(savedGoal) : null
  const toGoal = stats && savedGoal ? stats.latest - savedGoal : null

  // Y axis domain with padding
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return ['auto', 'auto']
    const weights = chartData.map(d => d.weight)
    const min = Math.min(...weights) - 2
    const max = Math.max(...weights) + 2
    return [parseFloat(min.toFixed(1)), parseFloat(max.toFixed(1))]
  }, [chartData])

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Unit toggle */}
          <div className="flex gap-0.5 p-1 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {(['kg', 'lbs'] as const).map(u => (
              <button key={u} onClick={() => setUnitKg(u === 'kg')}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{ background: (u === 'kg') === unitKg ? 'var(--surface3)' : 'transparent', color: (u === 'kg') === unitKg ? 'var(--accent)' : 'var(--text-muted)' }}>
                {u}
              </button>
            ))}
          </div>

          {/* Range filter */}
          <div className="flex gap-0.5 p-1 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {RANGE_OPTIONS.map(r => (
              <button key={r.label} onClick={() => setRange(r.days)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{ background: range === r.days ? 'var(--surface3)' : 'transparent', color: range === r.days ? 'var(--accent)' : 'var(--text-muted)' }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setGoalModal(true)}>
            <Target size={13} /> {savedGoal ? `Goal: ${goalDisplay}${unit}` : 'Set Goal'}
          </Button>
          <Button variant="accent" onClick={() => {
            setForm({ date: format(new Date(), 'yyyy-MM-dd'), weight_kg: latestLog ? String(toDisplay(latestLog.weight_kg)) : '', body_fat_pct: '', notes: '' })
            setModalOpen(true)
          }}>
            <Plus size={13} /> Log Weight
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Current */}
          <Card>
            <CardBody className="py-4">
              <div className="flex items-center gap-2 mb-2">
                <Scale size={14} style={{ color: 'var(--accent)' }} />
                <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Current</span>
              </div>
              <div className="font-display font-extrabold text-3xl" style={{ color: 'var(--accent)' }}>
                {toDisplay(stats.latest).toFixed(1)}
                <span className="text-sm font-mono font-normal ml-1">{unit}</span>
              </div>
              {latestLog?.body_fat_pct && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {latestLog.body_fat_pct}% body fat
                </div>
              )}
            </CardBody>
          </Card>

          {/* Change */}
          <Card>
            <CardBody className="py-4">
              <div className="flex items-center gap-2 mb-2">
                {stats.change < 0
                  ? <TrendingDown size={14} style={{ color: 'var(--accent)' }} />
                  : stats.change > 0
                  ? <TrendingUp size={14} style={{ color: 'var(--accent3)' }} />
                  : <Minus size={14} style={{ color: 'var(--text-muted)' }} />}
                <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
                  Change ({RANGE_OPTIONS.find(r => r.days === range)?.label || 'All'})
                </span>
              </div>
              <div className="font-display font-extrabold text-3xl"
                style={{ color: stats.change < 0 ? 'var(--accent)' : stats.change > 0 ? 'var(--accent3)' : 'var(--text-muted)' }}>
                {stats.change > 0 ? '+' : ''}{toDisplay(stats.change).toFixed(1)}
                <span className="text-sm font-mono font-normal ml-1">{unit}</span>
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {stats.weeklyRate > 0 ? '+' : ''}{toDisplay(stats.weeklyRate).toFixed(2)}{unit}/week
              </div>
            </CardBody>
          </Card>

          {/* Goal */}
          <Card>
            <CardBody className="py-4">
              <div className="flex items-center gap-2 mb-2">
                <Target size={14} style={{ color: 'var(--accent5)' }} />
                <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Goal</span>
              </div>
              {goalDisplay ? (
                <>
                  <div className="font-display font-extrabold text-3xl" style={{ color: 'var(--accent5)' }}>
                    {goalDisplay.toFixed(1)}
                    <span className="text-sm font-mono font-normal ml-1">{unit}</span>
                  </div>
                  {toGoal !== null && (
                    <div className="text-xs mt-1" style={{ color: toGoal <= 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {toGoal <= 0 ? '🎉 Goal reached!' : `${toDisplay(toGoal).toFixed(1)}${unit} to go`}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>No goal set</div>
              )}
            </CardBody>
          </Card>

          {/* Range stats */}
          <Card>
            <CardBody className="py-4">
              <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Range</div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>Low</span>
                  <span className="font-medium" style={{ color: 'var(--accent4)' }}>{toDisplay(stats.min).toFixed(1)}{unit}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>High</span>
                  <span className="font-medium" style={{ color: 'var(--accent3)' }}>{toDisplay(stats.max).toFixed(1)}{unit}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>Entries</span>
                  <span className="font-medium">{filtered.length}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <Scale size={36} className="mb-4" style={{ color: 'var(--text-dim)' }} />
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>No weight entries yet</p>
          <p className="text-xs mb-6" style={{ color: 'var(--text-dim)' }}>Start logging to see your progress</p>
          <Button variant="accent" onClick={() => setModalOpen(true)}><Plus size={13} /> Log First Entry</Button>
        </div>
      )}

      {/* Main chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <span className="font-display font-bold text-sm">Weight Progress</span>
            <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded inline-block" style={{ background: 'var(--accent)' }} /> Weight
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded inline-block border-dashed border" style={{ borderColor: 'var(--accent2)' }} /> 7-day avg
              </span>
              {savedGoal && (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded inline-block" style={{ background: 'var(--accent5)' }} /> Goal
                </span>
              )}
            </div>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false}
                  interval={Math.max(0, Math.floor(chartData.length / 8))} />
                <YAxis domain={yDomain as [number, number]} tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false}
                  tickFormatter={v => `${v}${unit}`} width={55} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, name: string) => [`${v} ${unit}`, name === 'weight' ? 'Weight' : '7-day avg']} />
                {savedGoal && (
                  <ReferenceLine y={parseFloat(toDisplay(savedGoal).toFixed(2))} stroke="var(--accent5)"
                    strokeDasharray="6 3" strokeWidth={1.5}
                    label={{ value: `Goal ${toDisplay(savedGoal).toFixed(1)}${unit}`, fill: 'var(--accent5)', fontSize: 10, position: 'insideTopRight' }} />
                )}
                <Area type="monotone" dataKey="weight" stroke="var(--accent)" fill="url(#gWeight)"
                  strokeWidth={2} dot={{ fill: 'var(--accent)', r: 2.5, strokeWidth: 0 }} activeDot={{ r: 5 }} name="weight" />
                <Line type="monotone" dataKey="avg" stroke="var(--accent2)" strokeWidth={1.5}
                  strokeDasharray="4 3" dot={false} name="avg" />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}

      {/* Body fat chart */}
      {chartData.some(d => d.body_fat !== null) && (
        <Card>
          <CardHeader>
            <span className="font-display font-bold text-sm">Body Fat %</span>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent3)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--accent3)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false}
                  interval={Math.max(0, Math.floor(chartData.length / 8))} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false}
                  tickFormatter={v => `${v}%`} width={40} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'Body Fat']} />
                <Area type="monotone" dataKey="body_fat" stroke="var(--accent3)" fill="url(#gFat)"
                  strokeWidth={2} dot={{ fill: 'var(--accent3)', r: 2.5, strokeWidth: 0 }} connectNulls name="body_fat" />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}

      {/* Log table */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <span className="font-display font-bold text-sm">History</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{logs.length} entries</span>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Date', `Weight (${unit})`, 'Body Fat %', 'Change', 'Notes', ''].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 text-[10px] tracking-widest uppercase"
                      style={{ color: 'var(--text-dim)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...logs].reverse().map((log, i, arr) => {
                  const prev = arr[i + 1]
                  const change = prev ? log.weight_kg - prev.weight_kg : null
                  const changeDisplay = change !== null ? toDisplay(change).toFixed(2) : null
                  return (
                    <tr key={log.id} className="group border-b transition-colors"
                      style={{ borderColor: 'var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-5 py-3 text-xs font-medium">
                        {format(parseISO(log.date), 'EEE, MMM d yyyy')}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-display font-bold text-sm" style={{ color: 'var(--accent)' }}>
                          {toDisplay(log.weight_kg).toFixed(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {log.body_fat_pct ? `${log.body_fat_pct}%` : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {changeDisplay !== null ? (
                          <span style={{ color: parseFloat(changeDisplay) < 0 ? 'var(--accent)' : parseFloat(changeDisplay) > 0 ? 'var(--accent3)' : 'var(--text-muted)' }}>
                            {parseFloat(changeDisplay) > 0 ? '+' : ''}{changeDisplay} {unit}
                          </span>
                        ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3 text-xs max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {log.notes || '—'}
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => setDeleteId(log.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                          style={{ color: 'var(--text-dim)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent3)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Log Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Weight">
        <div className="space-y-4">
          <Input label="Date" type="date" value={form.date}
            onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          <Input label={`Weight (${unit})`} type="number" step="0.1"
            placeholder={unitKg ? '75.5' : '166.4'} value={form.weight_kg}
            onChange={e => setForm(p => ({ ...p, weight_kg: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addLog()} />
          <Input label="Body Fat % (optional)" type="number" step="0.1"
            placeholder="18.5" value={form.body_fat_pct}
            onChange={e => setForm(p => ({ ...p, body_fat_pct: e.target.value }))} />
          <Input label="Notes (optional)" placeholder="Morning, fasted, after workout..."
            value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={addLog} disabled={!form.weight_kg}>
              Save Entry
            </Button>
          </div>
        </div>
      </Modal>

      {/* Goal Modal */}
      <Modal open={goalModal} onClose={() => setGoalModal(false)} title="Set Weight Goal">
        <div className="space-y-4">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Your goal will appear as a reference line on the chart.
          </p>
          <Input label={`Target Weight (${unit})`} type="number" step="0.1"
            placeholder={unitKg ? '70.0' : '154.0'}
            value={goalWeight} onChange={e => setGoalWeight(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveGoal()} />
          <div className="flex justify-end gap-2 pt-2">
            {savedGoal && (
              <Button variant="danger" onClick={() => { setSavedGoal(null); localStorage.removeItem('weight_goal'); setGoalModal(false) }}>
                Clear Goal
              </Button>
            )}
            <Button onClick={() => setGoalModal(false)}>Cancel</Button>
            <Button variant="accent" onClick={saveGoal}>Save Goal</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Entry">
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Are you sure? This cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteId && deleteLog(deleteId)}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
