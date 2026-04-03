'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarEvent } from '@/types'
import { Button, Modal, Input, Select } from '@/components/ui'
import { ChevronLeft, ChevronRight, Plus, Trash2, X, Pencil } from 'lucide-react'
import {
  format, addMonths, subMonths, addWeeks, subWeeks,
  startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  isSameMonth, isSameDay, isToday, parseISO
} from 'date-fns'
import { cn, EVENT_COLORS } from '@/lib/utils'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

const EVENT_TYPE_OPTIONS = [
  { value: 'event', label: '🗓️ Event' },
  { value: 'reminder', label: '🔔 Reminder' },
  { value: 'workout', label: '💪 Workout' },
  { value: 'goal', label: '🎯 Goal' },
]

interface CalendarBlock {
  id: string; user_id: string; date: string; name: string
  color: string; start_time: string; end_time: string; task_ids: string[]
}

interface Task { id: string; text: string; column_id: string }

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 40 // px per hour — 30min slots = 20px

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}
function snapToSlot(minutes: number, slot = 15): number {
  return Math.round(minutes / slot) * slot
}

export default function CalendarClient({ initialEvents, userId }: { initialEvents: CalendarEvent[]; userId: string }) {
  const supabase = createClient()
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week')
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Events
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [eventModal, setEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [eventForm, setEventForm] = useState({ title: '', description: '', time: '', type: 'event' as CalendarEvent['type'], recurrence: 'none' as 'none' | 'daily' | 'weekdays' })

  // Blocks
  const [blocks, setBlocks] = useState<CalendarBlock[]>([])
  const [blocksLoaded, setBlocksLoaded] = useState(false)
  const [blockModal, setBlockModal] = useState(false)
  const [editingBlock, setEditingBlock] = useState<CalendarBlock | null>(null)
  const [lastUsedColor, setLastUsedColor] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('cal_last_color') || '#7b6cfa'
    return '#7b6cfa'
  })
  const [blockForm, setBlockForm] = useState({ name: '', color: '#7b6cfa', start_time: '09:00', end_time: '10:00', task_ids: [] as string[] })
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoaded, setTasksLoaded] = useState(false)

  // Grid drag state (draw new block)
  const gridRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ y: number; minutes: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<number | null>(null)
  const [dragDate, setDragDate] = useState<string>('')

  // Block move drag state
  const [movingBlock, setMovingBlock] = useState<CalendarBlock | null>(null)
  const [moveOffsetMins, setMoveOffsetMins] = useState(0) // cursor offset from block top
  const [movePreview, setMovePreview] = useState<{ start: number; end: number } | null>(null)

  // Week days
  const weekStart = startOfWeek(viewDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
  })

  // Month grid
  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const monthDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

  useEffect(() => {
    if (viewMode !== 'month') loadBlocks()
  }, [viewMode, viewDate])

  async function loadBlocks() {
    if (blocksLoaded && viewMode === 'week') return
    const start = format(weekStart, 'yyyy-MM-dd')
    const end = format(weekDays[6], 'yyyy-MM-dd')
    const { data } = await supabase.from('calendar_blocks').select('*')
      .eq('user_id', userId).gte('date', start).lte('date', end).order('start_time')
    setBlocks(data || [])
    setBlocksLoaded(true)
  }

  async function loadTasks() {
    if (tasksLoaded) return
    const { data } = await supabase.from('tasks').select('id,text,column_id').eq('user_id', userId)
    setTasks(data || [])
    setTasksLoaded(true)
  }

  // ── Drag helpers ─────────────────────────────────────────
  function getMinutesFromY(clientY: number): number {
    if (!gridRef.current) return 0
    const rect = gridRef.current.getBoundingClientRect()
    const relY = clientY - rect.top + gridRef.current.scrollTop
    const rawMinutes = (relY / HOUR_HEIGHT) * 60
    return Math.max(0, Math.min(23 * 60 + 59, snapToSlot(rawMinutes)))
  }

  const draggingRef     = useRef(false)
  const dragStartRef    = useRef<{ y: number; minutes: number } | null>(null)
  const dragEndRef      = useRef<number | null>(null)
  const dragDateRef     = useRef('')
  const movingBlockRef  = useRef<CalendarBlock | null>(null)
  const moveOffsetRef   = useRef(0)
  const movePreviewRef  = useRef<{ start: number; end: number } | null>(null)

  useEffect(() => { draggingRef.current    = dragging    }, [dragging])
  useEffect(() => { dragStartRef.current   = dragStart   }, [dragStart])
  useEffect(() => { dragEndRef.current     = dragEnd     }, [dragEnd])
  useEffect(() => { dragDateRef.current    = dragDate    }, [dragDate])
  useEffect(() => { movingBlockRef.current = movingBlock }, [movingBlock])
  useEffect(() => { moveOffsetRef.current  = moveOffsetMins }, [moveOffsetMins])
  useEffect(() => { movePreviewRef.current = movePreview }, [movePreview])

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const mb = movingBlockRef.current
      const mp = movePreviewRef.current
      if (mb && mp) {
        const cursorMins = getMinutesFromY(e.clientY)
        const duration   = timeToMinutes(mb.end_time) - timeToMinutes(mb.start_time)
        const newStart   = snapToSlot(Math.max(0, Math.min(24 * 60 - duration, cursorMins - moveOffsetRef.current)))
        setMovePreview({ start: newStart, end: newStart + duration })
        return
      }
      if (!draggingRef.current || !dragStartRef.current) return
      const mins = getMinutesFromY(e.clientY)
      setDragEnd(Math.max(dragStartRef.current.minutes + 15, mins))
    }

    async function onPointerUp() {
      const mb = movingBlockRef.current
      const mp = movePreviewRef.current
      if (mb && mp) {
        const wasMoved =
          mp.start !== timeToMinutes(mb.start_time) ||
          mp.end   !== timeToMinutes(mb.end_time)
        if (wasMoved) {
          const newStartTime = minutesToTime(mp.start)
          const newEndTime   = minutesToTime(mp.end)
          setBlocks(prev => prev.map(b =>
            b.id === mb.id ? { ...b, start_time: newStartTime, end_time: newEndTime } : b
          ))
          await supabase
            .from('calendar_blocks')
            .update({ start_time: newStartTime, end_time: newEndTime })
            .eq('id', mb.id)
        } else {
          setEditingBlock(mb)
          setBlockForm({
            name: mb.name, color: mb.color,
            start_time: mb.start_time, end_time: mb.end_time,
            task_ids: mb.task_ids || [],
          })
          setBlockModal(true)
          loadTasks()
        }
        setMovingBlock(null)
        setMovePreview(null)
        return
      }

      if (!draggingRef.current || !dragStartRef.current || dragEndRef.current === null) return
      const draggedMinutes = Math.abs(dragEndRef.current - dragStartRef.current.minutes)
      const savedStart = dragStartRef.current
      const savedEnd   = dragEndRef.current
      const savedDate  = dragDateRef.current
      setDragging(false)
      setDragStart(null)
      setDragEnd(null)
      if (draggedMinutes < 15) return
      const startTime = minutesToTime(savedStart.minutes)
      const endTime   = minutesToTime(Math.max(savedStart.minutes + 15, savedEnd))
      setBlockForm({ name: '', color: lastUsedColor, start_time: startTime, end_time: endTime, task_ids: [] })
      setEditingBlock(null)
      setBlockModal(true)
      loadTasks()
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup',   onPointerUp)
    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup',   onPointerUp)
    }
  }, [])

  function onGridMouseDown(e: React.MouseEvent, dateStr: string) {
    if (e.button !== 0) return
    e.preventDefault()
    const mins = getMinutesFromY(e.clientY)
    setDragging(true)
    setDragStart({ y: e.clientY, minutes: mins })
    setDragEnd(mins + 30)
    setDragDate(dateStr)
  }

  // ── Block CRUD ───────────────────────────────────────────
  async function saveBlock() {
    if (!blockForm.name.trim()) return
    if (editingBlock) {
      const updated = { ...editingBlock, ...blockForm }
      setBlocks(prev => prev.map(b => b.id === editingBlock.id ? updated : b))
      await supabase.from('calendar_blocks').update(blockForm).eq('id', editingBlock.id)
      toast.success('Block updated!')
    } else {
      const block: CalendarBlock = {
        id: crypto.randomUUID(), user_id: userId,
        date: dragDate || format(selectedDate, 'yyyy-MM-dd'),
        ...blockForm,
      }
      setBlocks(prev => [...prev, block])
      await supabase.from('calendar_blocks').insert(block)
      toast.success('Block created!')
    }
    setLastUsedColor(blockForm.color)
    localStorage.setItem('cal_last_color', blockForm.color)
    setBlockModal(false); setEditingBlock(null)
  }

  async function deleteBlock(id: string) {
    setBlocks(prev => prev.filter(b => b.id !== id))
    await supabase.from('calendar_blocks').delete().eq('id', id)
    toast.success('Block deleted')
  }

  // ── Events CRUD ──────────────────────────────────────────
  function openEditEvent(ev: CalendarEvent, e?: React.MouseEvent) {
    e?.stopPropagation()
    setEditingEvent(ev)
    setEventForm({
      title: ev.title,
      description: ev.description || '',
      time: ev.time || '',
      type: ev.type,
      recurrence: (ev as CalendarEvent & { recurrence?: string }).recurrence as 'none' | 'daily' | 'weekdays' || 'none',
    })
    setEventModal(true)
  }

  function openNewEvent() {
    setEditingEvent(null)
    setEventForm({ title: '', description: '', time: '', type: 'event', recurrence: 'none' })
    setEventModal(true)
  }

  async function saveEvent() {
    if (!eventForm.title.trim()) return

    if (editingEvent) {
      const updated: CalendarEvent = {
        ...editingEvent,
        title: eventForm.title,
        description: eventForm.description,
        time: eventForm.time || undefined,
        type: eventForm.type,
        color: EVENT_COLORS[eventForm.type],
      }
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? updated : e))
      setEventModal(false)
      setEditingEvent(null)
      await supabase.from('events').update({
        title: updated.title,
        description: updated.description,
        time: updated.time,
        type: updated.type,
        color: updated.color,
      }).eq('id', editingEvent.id)
      toast.success('Event updated!')
    } else {
      const event: CalendarEvent = {
        id: crypto.randomUUID(), user_id: userId,
        title: eventForm.title, description: eventForm.description,
        date: format(selectedDate, 'yyyy-MM-dd'), time: eventForm.time || undefined,
        type: eventForm.type, color: EVENT_COLORS[eventForm.type],
        created_at: new Date().toISOString(),
      }
      setEvents(prev => [...prev, event])
      setEventModal(false)
      setEventForm({ title: '', description: '', time: '', type: 'event', recurrence: 'none' })
      await supabase.from('events').insert(event)
      toast.success('Event added!')
    }
  }

  async function deleteEvent(id: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    setEvents(prev => prev.filter(e => e.id !== id))
    if (editingEvent?.id === id) {
      setEventModal(false)
      setEditingEvent(null)
    }
    await supabase.from('events').delete().eq('id', id)
    toast.success('Event deleted')
  }

  // ── Render helpers ───────────────────────────────────────
  function getBlocksForDate(dateStr: string) {
    return blocks.filter(b => b.date === dateStr)
  }
  function getEventsForDate(dateStr: string) {
    return events.filter(e => e.date === dateStr)
  }

  // Changed from Component to standard render function to avoid DOM remounts
  function renderBlockItem(block: CalendarBlock) {
    const isMoving = movingBlock?.id === block.id
    const startMins = (isMoving && movePreview) ? movePreview.start : timeToMinutes(block.start_time)
    const endMins   = (isMoving && movePreview) ? movePreview.end   : timeToMinutes(block.end_time)
    const top = (startMins / 60) * HOUR_HEIGHT
    const height = Math.max(20, ((endMins - startMins) / 60) * HOUR_HEIGHT)
    const linkedTasks = tasks.filter(t => block.task_ids?.includes(t.id))

    function onBlockMouseDown(e: React.MouseEvent) {
      e.stopPropagation()
      if (e.button !== 0) return
      const blockTopMins = timeToMinutes(block.start_time)
      const cursorMins = getMinutesFromY(e.clientY)
      const offsetMins = cursorMins - blockTopMins
      setMovingBlock(block)
      setMoveOffsetMins(offsetMins)
      setMovePreview({
        start: timeToMinutes(block.start_time),
        end: timeToMinutes(block.end_time),
      })
    }

    return (
      <div
        key={block.id}
        className="absolute left-1 right-1 rounded-lg px-2 py-1 overflow-hidden group"
        style={{
          top,
          height,
          background: `${block.color}22`,
          border: `1.5px solid ${block.color}`,
          zIndex: isMoving ? 30 : 10,
          cursor: isMoving ? 'grabbing' : 'grab',
          opacity: isMoving ? 0.85 : 1,
          userSelect: 'none',
        }}
        onMouseDown={onBlockMouseDown}
      >
        <div className="text-[10px] font-bold truncate" style={{ color: block.color }}>{block.name}</div>
        {height > 30 && (
          <div className="text-[9px] truncate" style={{ color: `${block.color}aa` }}>
            {minutesToTime(startMins).slice(0,5)} – {minutesToTime(endMins).slice(0,5)}
          </div>
        )}
        {height > 50 && linkedTasks.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {linkedTasks.slice(0, 2).map(t => (
              <div key={t.id} className="text-[9px] truncate px-1 rounded" style={{ background: `${block.color}33`, color: `${block.color}cc` }}>• {t.text}</div>
            ))}
          </div>
        )}
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); deleteBlock(block.id) }}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: block.color }}
        >
          <X size={10} />
        </button>
      </div>
    )
  }

  // Changed from Component to standard render function
  function renderEventDot(ev: CalendarEvent) {
    return (
      <button
        key={ev.id}
        onClick={e => openEditEvent(ev, e)}
        className="w-1.5 h-1.5 rounded-full hover:scale-150 transition-transform"
        style={{ background: ev.color }}
        title={ev.title}
      />
    )
  }

  // Changed from Component to standard render function
  function renderTimeGrid(dates: Date[]) {
    const isMultiDay = dates.length > 1
    return (
      <div
        className="flex flex-col h-full rounded-xl border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="w-14 flex-shrink-0 border-r" style={{ borderColor: 'var(--border)' }} />
          {dates.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const dayEvents = getEventsForDate(dateStr)
            return (
              <div key={dateStr} className={cn('flex-1 py-2 text-center border-r last:border-r-0', isToday(day) && 'relative')}
                style={{ borderColor: 'var(--border)' }}>
                <div className="text-[9px] tracking-widest uppercase mb-0.5" style={{ color: 'var(--text-dim)' }}>
                  {format(day, 'EEE')}
                </div>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs mx-auto font-display font-bold"
                  style={{
                    background: isToday(day) ? 'var(--accent)' : 'transparent',
                    color: isToday(day) ? '#0e0e10' : 'var(--text)',
                  }}
                >
                  {format(day, 'd')}
                </div>
                {dayEvents.length > 0 && (
                  <div className="flex justify-center gap-0.5 mt-1 flex-wrap px-1">
                    {dayEvents.slice(0, 3).map(ev => renderEventDot(ev))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div
          className="flex min-h-0 flex-1 overflow-y-auto"
          ref={gridRef}
        >
          <div className="w-14 flex-shrink-0 border-r relative" style={{ borderColor: 'var(--border)', height: 24 * HOUR_HEIGHT }}>
            {HOURS.map(h => (
              <div key={h} className="absolute w-full flex items-start justify-end pr-2 pt-0.5"
                style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
            {HOURS.map(h => (
              <div key={`${h}-30`} className="absolute w-full flex items-start justify-end pr-2 pt-0.5"
                style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2, height: HOUR_HEIGHT / 2 }}>
                <span className="text-[8px]" style={{ color: 'var(--text-dim)', opacity: 0.5 }}>{String(h).padStart(2, '0')}:30</span>
              </div>
            ))}
          </div>

          {dates.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const dayBlocks = getBlocksForDate(dateStr)
            const isDragDay = dragging && dragDate === dateStr
            return (
              <div
                key={dateStr}
                className={cn("flex-1 border-r last:border-r-0 relative select-none", movingBlock ? "cursor-grabbing" : "cursor-crosshair")}
                style={{ borderColor: 'var(--border)', height: 24 * HOUR_HEIGHT }}
                onMouseDown={e => onGridMouseDown(e, dateStr)}
              >
                {HOURS.map(h => (
                  <div key={h} className="absolute w-full border-b" style={{ top: h * HOUR_HEIGHT, borderColor: 'var(--border)', opacity: 0.5 }} />
                ))}
                {HOURS.map(h => (
                  <div key={`${h}-30`} className="absolute w-full border-b border-dashed" style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2, borderColor: 'var(--border)', opacity: 0.25 }} />
                ))}
                {HOURS.map(h => (
                  <div key={`${h}-15`} className="absolute w-full border-b border-dotted" style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 4, borderColor: 'var(--border)', opacity: 0.12 }} />
                ))}
                {HOURS.map(h => (
                  <div key={`${h}-45`} className="absolute w-full border-b border-dotted" style={{ top: h * HOUR_HEIGHT + (HOUR_HEIGHT * 3) / 4, borderColor: 'var(--border)', opacity: 0.12 }} />
                ))}

                {dayBlocks.map(block => renderBlockItem(block))}

                {isDragDay && dragStart && dragEnd !== null && (
                  <div className="absolute left-1 right-1 rounded-lg border-2 pointer-events-none"
                    style={{
                      top: (dragStart.minutes / 60) * HOUR_HEIGHT,
                      height: Math.max(15, ((Math.max(dragStart.minutes + 15, dragEnd) - dragStart.minutes) / 60) * HOUR_HEIGHT),
                      background: '#7b6cfa22', borderColor: '#7b6cfa', zIndex: 20,
                    }}>
                    <div className="px-2 py-1 text-[10px]" style={{ color: '#7b6cfa' }}>
                      {minutesToTime(dragStart.minutes)} – {minutesToTime(Math.max(dragStart.minutes + 15, dragEnd))}
                    </div>
                  </div>
                )}

                {isToday(day) && (() => {
                  const now = new Date()
                  const mins = now.getHours() * 60 + now.getMinutes()
                  return (
                    <div className="absolute left-0 right-0 pointer-events-none z-20" style={{ top: (mins / 60) * HOUR_HEIGHT }}>
                      <div className="w-2 h-2 rounded-full -translate-y-1 -translate-x-1" style={{ background: 'var(--accent3)' }} />
                      <div className="absolute top-0 left-2 right-0 border-t" style={{ borderColor: 'var(--accent3)' }} />
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => viewMode === 'week' ? setViewDate(subWeeks(viewDate, 1)) : setViewDate(subMonths(viewDate, 1))}
            className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={16} />
          </button>
          <h2 className="font-display font-extrabold text-lg min-w-[180px] text-center">
            {viewMode === 'week'
              ? `${format(weekStart, 'MMM d')} – ${format(weekDays[6], 'MMM d, yyyy')}`
              : format(viewDate, 'MMMM yyyy')}
          </h2>
          <button onClick={() => viewMode === 'week' ? setViewDate(addWeeks(viewDate, 1)) : setViewDate(addMonths(viewDate, 1))}
            className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
            <ChevronRight size={16} />
          </button>
          <Button size="sm" onClick={() => setViewDate(new Date())} style={{ color: 'var(--text-muted)' }}>Today</Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 p-1 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {(['month', 'week', 'day'] as const).map(v => (
              <button key={v} onClick={() => { setViewMode(v); if (v !== 'month') setBlocksLoaded(false) }}
                className="px-3 py-1.5 rounded-md text-xs capitalize transition-all"
                style={{ background: viewMode === v ? 'var(--surface3)' : 'transparent', color: viewMode === v ? 'var(--accent)' : 'var(--text-muted)' }}>
                {v}
              </button>
            ))}
          </div>
          <Button size="sm" variant="accent" onClick={openNewEvent}>
            <Plus size={12} /> Event
          </Button>
        </div>
      </div>

      {viewMode === 'month' && (
        <div className="flex-1 flex flex-col rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="py-2.5 text-center text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>{d}</div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
            {monthDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const dayEvents = getEventsForDate(dateStr)
              const isSelected = isSameDay(day, selectedDate)
              return (
                <div key={dateStr} onClick={() => { setSelectedDate(day); setViewMode('day'); setViewDate(day) }}
                  className={cn('border-r border-b p-2 cursor-pointer transition-all min-h-[80px]', isSelected && 'ring-1 ring-inset ring-[var(--accent)]')}
                  style={{ borderColor: 'var(--border)', background: isSelected ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : undefined }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs mb-1.5 font-medium"
                    style={{ background: isToday(day) ? 'var(--accent)' : 'transparent', color: isToday(day) ? '#0e0e10' : isSameMonth(day, viewDate) ? 'var(--text)' : 'var(--text-dim)' }}>
                    {format(day, 'd')}
                  </div>
                  {dayEvents.slice(0, 2).map(ev => (
                    <div
                      key={ev.id}
                      className="group flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded mb-0.5"
                      style={{ background: `${ev.color}22`, color: ev.color }}
                      onClick={e => openEditEvent(ev, e)}
                    >
                      <span className="flex-1 truncate">{ev.title}</span>
                      <button
                        onClick={e => deleteEvent(ev.id, e)}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0"
                      >
                        <X size={8} />
                      </button>
                    </div>
                  ))}
                  {dayEvents.length > 2 && <div className="text-[9px]" style={{ color: 'var(--text-dim)' }}>+{dayEvents.length - 2} more</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {viewMode === 'week' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {renderTimeGrid(weekDays)}
        </div>
      )}

      {viewMode === 'day' && (
        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            {renderTimeGrid([selectedDate])}
          </div>
          <div className="w-64 flex flex-col rounded-xl border overflow-hidden flex-shrink-0" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="font-display font-extrabold text-lg">{format(selectedDate, 'EEE d')}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{format(selectedDate, 'MMMM yyyy')}</div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <p className="text-[10px] tracking-widest uppercase px-1 mb-2" style={{ color: 'var(--text-dim)' }}>Events</p>
              {getEventsForDate(format(selectedDate, 'yyyy-MM-dd')).map(ev => (
                <div key={ev.id} className="group flex gap-2 p-2.5 rounded-xl border"
                  style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
                  <div className="w-0.5 rounded-full flex-shrink-0 self-stretch" style={{ background: ev.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{ev.title}</div>
                    {ev.time && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{ev.time}</div>}
                  </div>
                  <button onClick={e => openEditEvent(ev, e)} className="opacity-0 group-hover:opacity-100 p-0.5" style={{ color: 'var(--text-dim)' }}>
                    <Pencil size={11} />
                  </button>
                  <button onClick={e => deleteEvent(ev.id, e)} className="opacity-0 group-hover:opacity-100 p-0.5" style={{ color: 'var(--text-dim)' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              {getEventsForDate(format(selectedDate, 'yyyy-MM-dd')).length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-dim)' }}>No events</p>
              )}
            </div>
            <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <Button size="sm" variant="accent" className="w-full" onClick={openNewEvent}>
                <Plus size={12} /> Add Event
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── BLOCK MODAL ── */}
      <Modal open={blockModal} onClose={() => { setBlockModal(false); setEditingBlock(null) }} title={editingBlock ? 'Edit Time Block' : 'New Time Block'} width="max-w-lg">
        <div className="space-y-4">
          <Input label="Block Name" placeholder="e.g. Deep Work, Morning Routine..." value={blockForm.name}
            onChange={e => setBlockForm(p => ({ ...p, name: e.target.value }))} />

          <div className="flex items-end gap-3">
            <Input label="Start Time" type="time" value={blockForm.start_time}
              onChange={e => setBlockForm(p => ({ ...p, start_time: e.target.value }))} />
            <Input label="End Time" type="time" value={blockForm.end_time}
              onChange={e => setBlockForm(p => ({ ...p, end_time: e.target.value }))} />
          </div>

          <div>
            <label className="block text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={blockForm.color} onChange={e => setBlockForm(p => ({ ...p, color: e.target.value }))}
                className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent" />
              <div className="flex gap-2">
                {['#7b6cfa', '#c8fa5f', '#fa6c6c', '#6cf0fa', '#fac86c', '#f06cfa', '#6cfaa0', '#fa9b6c'].map(c => (
                  <button key={c} onClick={() => setBlockForm(p => ({ ...p, color: c }))}
                    className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ background: c, borderColor: blockForm.color === c ? 'var(--text)' : 'transparent' }} />
                ))}
              </div>
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{blockForm.color}</span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Link Tasks (optional)</label>
            {tasks.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No tasks found in your Kanban board</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border p-2" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
                {tasks.filter(t => t.column_id !== 'done').map(task => {
                  const linked = blockForm.task_ids.includes(task.id)
                  return (
                    <label key={task.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all"
                      style={{ background: linked ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent' }}>
                      <input type="checkbox" checked={linked}
                        onChange={e => setBlockForm(p => ({
                          ...p,
                          task_ids: e.target.checked ? [...p.task_ids, task.id] : p.task_ids.filter(id => id !== task.id)
                        }))} className="rounded" />
                      <span className="text-xs truncate">{task.text}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {editingBlock && (
              <Button variant="danger" onClick={() => { deleteBlock(editingBlock.id); setBlockModal(false); setEditingBlock(null) }}>Delete</Button>
            )}
            <Button onClick={() => { setBlockModal(false); setEditingBlock(null) }}>Cancel</Button>
            <Button variant="accent" onClick={saveBlock}>
              {editingBlock ? 'Save Changes' : 'Create Block'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── EVENT MODAL ── */}
      <Modal
        open={eventModal}
        onClose={() => { setEventModal(false); setEditingEvent(null) }}
        title={editingEvent
          ? `Edit Event — ${format(parseISO(editingEvent.date), 'MMM d')}`
          : `Add Event — ${format(selectedDate, 'MMM d')}`
        }
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="Event title"
            value={eventForm.title}
            onChange={e => setEventForm(p => ({ ...p, title: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && saveEvent()}
          />
          <Select
            label="Type"
            value={eventForm.type}
            onChange={e => setEventForm(p => ({ ...p, type: e.target.value as CalendarEvent['type'] }))}
            options={EVENT_TYPE_OPTIONS}
          />
          <Input
            label="Time (optional)"
            type="time"
            value={eventForm.time}
            onChange={e => setEventForm(p => ({ ...p, time: e.target.value }))}
          />
          <Input
            label="Description (optional)"
            placeholder="Details..."
            value={eventForm.description}
            onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))}
          />
          {!editingEvent && (
            <Select
              label="Repeat"
              value={eventForm.recurrence}
              onChange={e => setEventForm(p => ({ ...p, recurrence: e.target.value as 'none' | 'daily' | 'weekdays' }))}
              options={[
                { value: 'none', label: '🔁 No repeat' },
                { value: 'daily', label: '📅 Every day (365 days)' },
                { value: 'weekdays', label: '💼 Every weekday Mon–Fri (365 days)' },
              ]}
            />
          )}
          <div className="flex justify-end gap-2 pt-2">
            {editingEvent && (
              <Button variant="danger" onClick={() => deleteEvent(editingEvent.id)}>
                Delete
              </Button>
            )}
            <Button onClick={() => { setEventModal(false); setEditingEvent(null) }}>Cancel</Button>
            <Button variant="accent" onClick={saveEvent}>
              {editingEvent ? 'Save Changes' : 'Add Event'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}