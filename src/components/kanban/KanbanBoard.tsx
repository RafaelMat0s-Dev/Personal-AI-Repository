'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter, useDroppable,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { Task, ColumnId, ViewType, Tag, Priority } from '@/types'
import { TAG_COLORS, PRIORITY_LABELS, PRIORITY_STYLES, cn } from '@/lib/utils'
import { Button, Badge } from '@/components/ui'
import {
  Plus, GripVertical, Pencil, ChevronLeft, ChevronRight,
  FileText, CheckSquare, X, Check, Link2, AlignLeft,
} from 'lucide-react'
import { format, addDays, subDays, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

// ─── Constants ───────────────────────────────────────────────
const COLUMNS: { id: ColumnId; label: string; color: string }[] = [
  { id: 'backlog',    label: 'Backlog',      color: 'var(--text-dim)'  },
  { id: 'todo',       label: 'To Do',        color: 'var(--accent4)'   },
  { id: 'inprogress', label: 'In Progress',  color: 'var(--accent5)'   },
  { id: 'done',       label: 'Done',         color: 'var(--accent)'    },
]

const TAG_OPTIONS = ['work','personal','health','study','misc'].map(v => ({ value: v, label: v }))
const PRIORITY_OPTIONS = [
  { value: 'high', label: '🔴 High' },
  { value: 'mid',  label: '🟡 Mid'  },
  { value: 'low',  label: '⚪ Low'  },
]

// ─── Types ───────────────────────────────────────────────────
interface TaskTodo {
  id: string
  task_id: string
  text: string
  done: boolean
  position: number
}

interface TaskDetail extends Task {
  description?: string
  note_id?: string
  date?: string
  todos?: TaskTodo[]
}

interface Note { id: string; title: string }

// ─── Inline input ─────────────────────────────────────────────
function InlineInput({
  placeholder, onConfirm, className,
}: {
  placeholder: string
  onConfirm: (val: string) => void
  className?: string
}) {
  const [val, setVal] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <input
      ref={ref}
      value={val}
      onChange={e => setVal(e.target.value)}
      placeholder={placeholder}
      onKeyDown={e => {
        if (e.key === 'Enter' && val.trim()) { onConfirm(val.trim()); setVal('') }
        if (e.key === 'Escape') setVal('')
      }}
      className={cn('bg-transparent outline-none text-xs w-full', className)}
      style={{ color: 'var(--text)', caretColor: 'var(--accent)' }}
    />
  )
}

// ─── Task Detail Panel ────────────────────────────────────────
function TaskDetailPanel({
  task, notes, userId, onClose, onUpdate,
}: {
  task: TaskDetail
  notes: Note[]
  userId: string
  onClose: () => void
  onUpdate: (updated: TaskDetail) => void
}) {
  const supabase = createClient()
  const [description, setDescription] = useState(task.description || '')
  const [todos, setTodos] = useState<TaskTodo[]>(task.todos || [])
  const [linkedNoteId, setLinkedNoteId] = useState(task.note_id || '')
  const [addingTodo, setAddingTodo] = useState(false)
  const descTimeout = useRef<ReturnType<typeof setTimeout>>()

  // Load todos if not already loaded
  useEffect(() => {
    if (!task.todos) {
      supabase.from('task_todos').select('*')
        .eq('task_id', task.id).order('position')
        .then(({ data }) => setTodos(data || []))
    }
  }, [task.id])

  function saveDescription(val: string) {
    setDescription(val)
    clearTimeout(descTimeout.current)
    descTimeout.current = setTimeout(async () => {
      await supabase.from('tasks').update({ description: val }).eq('id', task.id)
      onUpdate({ ...task, description: val })
    }, 600)
  }

  async function addTodo(text: string) {
    const todo: TaskTodo = {
      id: crypto.randomUUID(), task_id: task.id,
      text, done: false, position: todos.length,
    }
    setTodos(prev => [...prev, todo])
    await supabase.from('task_todos').insert({ ...todo, user_id: userId })
    setAddingTodo(false)
  }

  async function toggleTodo(id: string) {
    const todo = todos.find(t => t.id === id)
    if (!todo) return
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
    await supabase.from('task_todos').update({ done: !todo.done }).eq('id', id)
  }

  async function deleteTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id))
    await supabase.from('task_todos').delete().eq('id', id)
  }

  async function saveLinkedNote(noteId: string) {
    setLinkedNoteId(noteId)
    await supabase.from('tasks').update({ note_id: noteId || null }).eq('id', task.id)
    onUpdate({ ...task, note_id: noteId || undefined })
  }

  const done   = todos.filter(t => t.done).length
  const total  = todos.length
  const pct    = total > 0 ? Math.round(done / total * 100) : 0
  const linked = notes.find(n => n.id === linkedNoteId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="h-full w-full max-w-lg flex flex-col border-l overflow-y-auto"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="px-6 py-4 border-b flex items-start gap-3 flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge className={TAG_COLORS[task.tag]}>{task.tag}</Badge>
              <span className={cn('text-[9px] tracking-wide', PRIORITY_STYLES[task.priority])}>
                {PRIORITY_LABELS[task.priority]}
              </span>
              {task.due_date && (
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  📅 {format(parseISO(task.due_date), 'MMM d')}
                </span>
              )}
              {task.date && (
                <span className="text-[9px]" style={{ color: 'var(--accent4)' }}>
                  🗓 {format(parseISO(task.date), 'EEE, MMM d')}
                </span>
              )}
            </div>
            <h2 className="font-display font-bold text-lg leading-snug">{task.text}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg flex-shrink-0 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">

          {/* Description */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlignLeft size={13} style={{ color: 'var(--text-muted)' }} />
              <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Description</span>
            </div>
            <textarea
              value={description}
              onChange={e => saveDescription(e.target.value)}
              placeholder="Add a description..."
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 text-xs border outline-none resize-none leading-relaxed transition-colors"
              style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* To-do list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckSquare size={13} style={{ color: 'var(--text-muted)' }} />
                <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
                  Checklist
                </span>
                {total > 0 && (
                  <span className="text-[10px]" style={{ color: 'var(--accent)' }}>{done}/{total}</span>
                )}
              </div>
              <button onClick={() => setAddingTodo(true)}
                className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
                style={{ color: 'var(--text-muted)', background: 'var(--surface2)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                <Plus size={11} /> Add item
              </button>
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div className="h-1 rounded-full mb-3" style={{ background: 'var(--surface3)' }}>
                <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
              </div>
            )}

            <div className="space-y-1.5">
              {todos.map(todo => (
                <div key={todo.id} className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--surface2)' }}>
                  <button onClick={() => toggleTodo(todo.id)}
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all"
                    style={{
                      background: todo.done ? 'var(--accent)' : 'transparent',
                      borderColor: todo.done ? 'var(--accent)' : 'var(--border)',
                    }}>
                    {todo.done && <Check size={10} style={{ color: '#0e0e10' }} />}
                  </button>
                  <span className="flex-1 text-xs" style={{
                    textDecoration: todo.done ? 'line-through' : 'none',
                    color: todo.done ? 'var(--text-dim)' : 'var(--text)',
                  }}>
                    {todo.text}
                  </span>
                  <button onClick={() => deleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-dim)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent3)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>
                    <X size={11} />
                  </button>
                </div>
              ))}

              {addingTodo && (
                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg border"
                  style={{ background: 'var(--surface2)', borderColor: 'var(--accent)' }}>
                  <div className="w-4 h-4 rounded border flex-shrink-0" style={{ borderColor: 'var(--border)' }} />
                  <InlineInput
                    placeholder="New item... (Enter to add)"
                    onConfirm={addTodo}
                  />
                  <button onClick={() => setAddingTodo(false)} style={{ color: 'var(--text-dim)' }}>
                    <X size={11} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Linked Note */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link2 size={13} style={{ color: 'var(--text-muted)' }} />
              <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Linked Note</span>
            </div>

            {linked ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
                style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
                <FileText size={13} style={{ color: 'var(--accent4)' }} />
                <span className="flex-1 text-xs font-medium truncate">{linked.title || 'Untitled'}</span>
                <button onClick={() => saveLinkedNote('')}
                  className="transition-colors" style={{ color: 'var(--text-dim)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent3)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <select
                value={linkedNoteId}
                onChange={e => saveLinkedNote(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-xs border outline-none cursor-pointer"
                style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: linkedNoteId ? 'var(--text)' : 'var(--text-dim)' }}>
                <option value="">— Link a note —</option>
                {notes.map(n => (
                  <option key={n.id} value={n.id}>{n.title || 'Untitled'}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────
function TaskCard({
  task, onDelete, onEdit, onOpenDetail,
}: {
  task: TaskDetail
  onDelete: (id: string) => void
  onEdit: (task: TaskDetail) => void
  onOpenDetail: (task: TaskDetail) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const hasTodos  = (task.todos?.length ?? 0) > 0
  const doneCount = task.todos?.filter(t => t.done).length ?? 0
  const totalCount = task.todos?.length ?? 0

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.4 : 1,
        background: 'var(--surface2)', borderColor: 'var(--border)',
      }}
      className="group rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2.5">
          {/* Drag handle */}
          <div {...attributes} {...listeners}
            className="mt-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 touch-none"
            style={{ color: 'var(--text-dim)' }}>
            <GripVertical size={13} />
          </div>

          {/* Title — click to open detail */}
          <p
            className="flex-1 text-xs leading-relaxed cursor-pointer hover:underline decoration-dotted"
            style={{ textUnderlineOffset: '3px' }}
            onClick={e => { e.stopPropagation(); onOpenDetail(task) }}
          >
            {task.text}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={e => { e.stopPropagation(); onEdit(task) }}
              style={{ color: 'var(--text-dim)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent2)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>
              <Pencil size={11} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(task.id) }}
              className="text-xs"
              style={{ color: 'var(--text-dim)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent3)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>×</button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={TAG_COLORS[task.tag]}>{task.tag}</Badge>
          <span className={cn('text-[9px] tracking-wide', PRIORITY_STYLES[task.priority])}>
            {PRIORITY_LABELS[task.priority]}
          </span>
          {task.due_date && (
            <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>
              {format(parseISO(task.due_date), 'MMM d')}
            </span>
          )}
          {task.note_id && (
            <span className="text-[9px] flex items-center gap-0.5" style={{ color: 'var(--accent4)' }}>
              <FileText size={9} /> note
            </span>
          )}
        </div>

        {/* Checklist mini progress */}
        {hasTodos && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>{doneCount}/{totalCount} done</span>
            </div>
            <div className="h-0.5 rounded-full" style={{ background: 'var(--surface3)' }}>
              <div className="h-0.5 rounded-full transition-all" style={{
                width: `${totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0}%`,
                background: 'var(--accent)',
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Droppable Column ─────────────────────────────────────────
function KanbanColumn({
  col, tasks, onDelete, onEdit, onAddClick, onOpenDetail,
}: {
  col: { id: ColumnId; label: string; color: string }
  tasks: TaskDetail[]
  onDelete: (id: string) => void
  onEdit: (task: TaskDetail) => void
  onAddClick: (colId: ColumnId) => void
  onOpenDetail: (task: TaskDetail) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div className="flex flex-col rounded-xl border overflow-hidden transition-colors"
      style={{
        background: isOver ? 'color-mix(in srgb, var(--accent) 4%, var(--surface))' : 'var(--surface)',
        borderColor: isOver ? 'var(--accent)' : 'var(--border)',
      }}>
      <div className="px-4 py-3.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
          <span className="font-display font-bold text-xs tracking-wider uppercase" style={{ color: col.color }}>
            {col.label}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}>
            {tasks.length}
          </span>
        </div>
        <button onClick={() => onAddClick(col.id)}
          className="w-6 h-6 rounded-full border flex items-center justify-center transition-all hover:scale-110"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = col.color; e.currentTarget.style.color = col.color }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
          <Plus size={12} />
        </button>
      </div>

      <div ref={setNodeRef} className="flex-1 p-3 space-y-2 min-h-[120px]">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onDelete={onDelete} onEdit={onEdit} onOpenDetail={onOpenDetail} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="h-20 flex items-center justify-center border-2 border-dashed rounded-xl transition-colors"
            style={{ borderColor: isOver ? 'var(--accent)' : 'var(--border)' }}>
            <span className="text-xs" style={{ color: isOver ? 'var(--accent)' : 'var(--text-dim)' }}>
              {isOver ? 'Release to drop' : 'Drop here'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Task Form Modal ──────────────────────────────────────────
function TaskModal({
  open, title, form, onClose, onSave, onChange, onDelete,
}: {
  open: boolean
  title: string
  form: { text: string; tag: Tag; priority: Priority; due_date: string; column_id: ColumnId; date: string }
  onClose: () => void
  onSave: () => void
  onChange: (patch: Partial<typeof form>) => void
  onDelete?: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-extrabold text-lg">{title}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
        </div>

        <div className="space-y-4">
          {/* Task text */}
          <div>
            <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Task</label>
            <input
              value={form.text}
              onChange={e => onChange({ text: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && onSave()}
              placeholder="What needs to be done?"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg text-xs border outline-none transition-colors"
              style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Column */}
          <div>
            <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Column</label>
            <select value={form.column_id} onChange={e => onChange({ column_id: e.target.value as ColumnId })}
              className="w-full px-3 py-2.5 rounded-lg text-xs border outline-none cursor-pointer"
              style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {/* Tag + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Tag</label>
              <select value={form.tag} onChange={e => onChange({ tag: e.target.value as Tag })}
                className="w-full px-3 py-2.5 rounded-lg text-xs border outline-none cursor-pointer"
                style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                {TAG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Priority</label>
              <select value={form.priority} onChange={e => onChange({ priority: e.target.value as Priority })}
                className="w-full px-3 py-2.5 rounded-lg text-xs border outline-none cursor-pointer"
                style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Date assigned + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Assigned Date</label>
              <input type="date" value={form.date} onChange={e => onChange({ date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg text-xs border outline-none"
                style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => onChange({ due_date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg text-xs border outline-none"
                style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {onDelete && (
              <button onClick={onDelete}
                className="px-4 py-2 rounded-lg text-xs border transition-all font-mono"
                style={{ borderColor: 'var(--accent3)', color: 'var(--accent3)' }}>
                Delete
              </button>
            )}
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs border transition-all font-mono"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--surface2)' }}>
              Cancel
            </button>
            <button onClick={onSave}
              className="px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all"
              style={{ background: 'var(--accent)', color: '#0e0e10', border: '1px solid var(--accent)' }}>
              {title === 'Edit Task' ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Board ───────────────────────────────────────────────
export default function KanbanBoard({ initialTasks, userId }: { initialTasks: Task[]; userId: string }) {
  const supabase = createClient()

  const [tasks, setTasks]       = useState<TaskDetail[]>(initialTasks)
  const [view, setView]         = useState<ViewType>('weekly')
  const [activeTask, setActiveTask] = useState<TaskDetail | null>(null)

  // Date navigation for daily view
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))

  // Notes for linking
  const [notes, setNotes] = useState<Note[]>([])
  const [notesLoaded, setNotesLoaded] = useState(false)

  // Detail panel
  const [detailTask, setDetailTask] = useState<TaskDetail | null>(null)

  // Modal
  const [modalOpen, setModalOpen]   = useState(false)
  const [editingTask, setEditingTask] = useState<TaskDetail | null>(null)
  const [form, setForm] = useState<{
    text: string; tag: Tag; priority: Priority
    due_date: string; column_id: ColumnId; date: string
  }>({ text: '', tag: 'misc', priority: 'mid', due_date: '', column_id: 'todo', date: '' })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Load notes lazily when detail panel opens
  async function loadNotes() {
    if (notesLoaded) return
    const { data } = await supabase.from('notes').select('id,title').eq('user_id', userId).order('updated_at', { ascending: false })
    setNotes(data || [])
    setNotesLoaded(true)
  }

  // Load todos for a task
  async function loadTodosForTask(task: TaskDetail): Promise<TaskDetail> {
    if (task.todos) return task
    const { data } = await supabase.from('task_todos').select('*').eq('task_id', task.id).order('position')
    return { ...task, todos: data || [] }
  }

  // Filter tasks
  const filtered = view === 'weekly'
    ? tasks.filter(t => t.view_type === 'weekly')
    : tasks.filter(t => t.view_type === 'daily' && (t.date === selectedDate || !t.date))

  function getColTasks(colId: ColumnId) {
    return filtered.filter(t => t.column_id === colId)
  }

  // Open detail panel
  async function openDetail(task: TaskDetail) {
    await loadNotes()
    const withTodos = await loadTodosForTask(task)
    setDetailTask(withTodos)
    // Keep tasks in sync with todos
    setTasks(prev => prev.map(t => t.id === withTodos.id ? withTodos : t))
  }

  function openAdd(colId: ColumnId = 'todo') {
    setEditingTask(null)
    setForm({
      text: '', tag: 'misc', priority: 'mid', due_date: '', column_id: colId,
      date: view === 'daily' ? selectedDate : '',
    })
    setModalOpen(true)
  }

  function openEdit(task: TaskDetail) {
    setEditingTask(task)
    setForm({
      text:      task.text,
      tag:       task.tag,
      priority:  task.priority,
      due_date:  task.due_date || '',
      column_id: task.column_id,
      date:      task.date || '',
    })
    setModalOpen(true)
  }

  function closeModal() { setModalOpen(false); setEditingTask(null) }

  async function saveTask() {
    if (!form.text.trim()) return

    if (editingTask) {
      const updated: TaskDetail = {
        ...editingTask,
        text:      form.text,
        tag:       form.tag,
        priority:  form.priority,
        due_date:  form.due_date || undefined,
        column_id: form.column_id,
        date:      form.date || undefined,
        updated_at: new Date().toISOString(),
      }
      setTasks(prev => prev.map(t => t.id === editingTask.id ? updated : t))
      if (detailTask?.id === editingTask.id) setDetailTask(updated)
      closeModal()
      await supabase.from('tasks').update({
        text: updated.text, tag: updated.tag, priority: updated.priority,
        due_date: updated.due_date ?? null, column_id: updated.column_id,
        date: updated.date ?? null, updated_at: updated.updated_at,
      }).eq('id', editingTask.id)
      toast.success('Task updated!')
    } else {
      const newTask: TaskDetail = {
        id: crypto.randomUUID(), user_id: userId,
        text: form.text, column_id: form.column_id,
        view_type: view, tag: form.tag, priority: form.priority,
        due_date: form.due_date || undefined,
        date: form.date || undefined,
        position: getColTasks(form.column_id).length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        todos: [],
      }
      setTasks(prev => [...prev, newTask])
      closeModal()
      await supabase.from('tasks').insert({
        id: newTask.id, user_id: userId, text: newTask.text,
        column_id: newTask.column_id, view_type: newTask.view_type,
        tag: newTask.tag, priority: newTask.priority,
        due_date: newTask.due_date ?? null, date: newTask.date ?? null,
        position: newTask.position,
      })
      toast.success('Task added!')
    }
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    if (detailTask?.id === id) setDetailTask(null)
    await supabase.from('tasks').delete().eq('id', id)
    toast.success('Task deleted')
  }

  // Drag handlers
  function onDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find(t => t.id === e.active.id) || null)
  }

  function onDragOver(e: DragEndEvent) {
    const { active, over } = e
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return
    const overIsColumn = COLUMNS.some(c => c.id === overId)
    const targetCol = overIsColumn ? (overId as ColumnId) : tasks.find(t => t.id === overId)?.column_id
    if (!targetCol) return
    setTasks(prev => prev.map(t => t.id === activeId ? { ...t, column_id: targetCol } : t))
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveTask(null)
    const { active } = e
    const task = tasks.find(t => t.id === active.id)
    if (!task) return
    await supabase.from('tasks')
      .update({ column_id: task.column_id, updated_at: new Date().toISOString() })
      .eq('id', active.id)
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {/* Weekly / Daily toggle */}
          <div className="flex gap-1 p-1 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {(['weekly', 'daily'] as ViewType[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-4 py-1.5 rounded-md text-xs transition-all capitalize font-medium"
                style={{
                  background: view === v ? 'var(--surface3)' : 'transparent',
                  color: view === v ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                {v}
              </button>
            ))}
          </div>

          {/* Date navigator — only in daily mode */}
          {view === 'daily' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <button onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                className="transition-colors" style={{ color: 'var(--text-muted)' }}>
                <ChevronLeft size={14} />
              </button>
              <span className="font-display font-bold text-xs min-w-[110px] text-center">
                {format(parseISO(selectedDate), 'EEE, MMM d')}
              </span>
              <button onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                className="transition-colors" style={{ color: 'var(--text-muted)' }}>
                <ChevronRight size={14} />
              </button>
              <button onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                className="text-[10px] px-2 py-0.5 rounded ml-1 transition-all"
                style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}>
                Today
              </button>
            </div>
          )}
        </div>

        <Button variant="accent" onClick={() => openAdd('todo')}>
          <Plus size={13} /> Add Task
        </Button>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <KanbanColumn key={col.id} col={col} tasks={getColTasks(col.id)}
              onDelete={deleteTask} onEdit={openEdit}
              onAddClick={openAdd} onOpenDetail={openDetail} />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="p-3 rounded-xl border shadow-2xl rotate-1"
              style={{ background: 'var(--surface2)', borderColor: 'var(--accent)', width: '240px', opacity: 0.95 }}>
              <p className="text-xs mb-2">{activeTask.text}</p>
              <div className="flex items-center gap-2">
                <Badge className={TAG_COLORS[activeTask.tag]}>{activeTask.tag}</Badge>
                <span className={cn('text-[9px]', PRIORITY_STYLES[activeTask.priority])}>
                  {PRIORITY_LABELS[activeTask.priority]}
                </span>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Task form modal */}
      <TaskModal
        open={modalOpen}
        title={editingTask ? 'Edit Task' : 'Add Task'}
        form={form}
        onClose={closeModal}
        onSave={saveTask}
        onChange={patch => setForm(p => ({ ...p, ...patch }))}
        onDelete={editingTask ? () => { deleteTask(editingTask.id); closeModal() } : undefined}
      />

      {/* Task detail side panel */}
      {detailTask && (
        <TaskDetailPanel
          task={detailTask}
          notes={notes}
          userId={userId}
          onClose={() => setDetailTask(null)}
          onUpdate={updated => {
            setDetailTask(updated)
            setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
          }}
        />
      )}
    </div>
  )
}
