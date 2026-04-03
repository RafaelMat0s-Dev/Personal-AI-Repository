'use client'

import { useState, useCallback } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { createClient } from '@/lib/supabase/client'
import { Task, ColumnId, ViewType, Tag, Priority } from '@/types'
import { TAG_COLORS, PRIORITY_LABELS, PRIORITY_STYLES, cn } from '@/lib/utils'
import { Button, Modal, Input, Select, Badge } from '@/components/ui'
import { Plus, GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

const COLUMNS: { id: ColumnId; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'var(--text-dim)' },
  { id: 'todo', label: 'To Do', color: 'var(--accent4)' },
  { id: 'inprogress', label: 'In Progress', color: 'var(--accent5)' },
  { id: 'done', label: 'Done', color: 'var(--accent)' },
]

const TAG_OPTIONS = ['work', 'personal', 'health', 'study', 'misc'].map(v => ({ value: v, label: v }))
const PRIORITY_OPTIONS = [
  { value: 'high', label: '🔴 High' },
  { value: 'mid', label: '🟡 Mid' },
  { value: 'low', label: '⚪ Low' },
]

// ─── Task Card ───────────────────────────────────────────────
function TaskCard({ task, onDelete }: { task: Task; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="group p-3.5 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ 
        transform: CSS.Transform.toString(transform), 
        transition, 
        opacity: isDragging ? 0.5 : 1,
        background: 'var(--surface2)', 
        borderColor: 'var(--border)' 
      }}
    >
      <div className="p-3.5 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-lg"
        style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
        <div className="flex items-start gap-2 mb-2.5">
          <div {...attributes} {...listeners} className="mt-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: 'var(--text-dim)' }}>
            <GripVertical size={13} />
          </div>
          <p className="flex-1 text-xs leading-relaxed">{task.text}</p>
          <button
            onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs flex-shrink-0"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent3)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          >×</button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={TAG_COLORS[task.tag]}>{task.tag}</Badge>
          <span className={cn('text-[9px] tracking-wide', PRIORITY_STYLES[task.priority])}>
            {PRIORITY_LABELS[task.priority]}
          </span>
          {task.due_date && (
            <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>
              {format(new Date(task.due_date), 'MMM d')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Column ──────────────────────────────────────────────────
function KanbanColumn({ col, tasks, onDelete, onAddClick }: {
  col: { id: ColumnId; label: string; color: string }
  tasks: Task[]
  onDelete: (id: string) => void
  onAddClick: (colId: ColumnId) => void
}) {
  return (
    <div className="flex flex-col rounded-xl border overflow-hidden"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="px-4 py-3.5 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
          <span className="font-display font-bold text-xs tracking-wider uppercase" style={{ color: col.color }}>
            {col.label}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}>
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddClick(col.id)}
          className="w-6 h-6 rounded-full border flex items-center justify-center transition-all hover:scale-110"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = col.color; e.currentTarget.style.color = col.color }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <Plus size={12} />
        </button>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-3 space-y-2 min-h-[120px]">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onDelete={onDelete} />
          ))}
          {tasks.length === 0 && (
            <div className="h-20 flex items-center justify-center border-2 border-dashed rounded-xl"
              style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Drop here</span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

// ─── Main Board ──────────────────────────────────────────────
export default function KanbanBoard({ initialTasks, userId }: { initialTasks: Task[]; userId: string }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [view, setView] = useState<ViewType>('weekly')
  const [modalOpen, setModalOpen] = useState(false)
  const [defaultCol, setDefaultCol] = useState<ColumnId>('todo')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [form, setForm] = useState({ text: '', tag: 'misc' as Tag, priority: 'mid' as Priority, due_date: '' })
  const supabase = createClient()

  const filtered = tasks.filter(t => t.view_type === view)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function getColTasks(colId: ColumnId) {
    return filtered.filter(t => t.column_id === colId)
  }

  function onAddClick(colId: ColumnId) {
    setDefaultCol(colId)
    setModalOpen(true)
  }

  async function addTask() {
    if (!form.text.trim()) return
    const newTask: Omit<Task, 'created_at' | 'updated_at'> = {
      id: crypto.randomUUID(),
      user_id: userId,
      text: form.text,
      column_id: defaultCol,
      view_type: view,
      tag: form.tag,
      priority: form.priority,
      due_date: form.due_date || undefined,
      position: getColTasks(defaultCol).length,
    }
    setTasks(prev => [...prev, newTask as Task])
    setModalOpen(false)
    setForm({ text: '', tag: 'misc', priority: 'mid', due_date: '' })
    const { error } = await supabase.from('tasks').insert(newTask)
    if (error) toast.error('Failed to save task')
    else toast.success('Task added!')
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  function onDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find(t => t.id === e.active.id) || null)
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    // Find target column from over id (could be task id or column area)
    const targetTask = tasks.find(t => t.id === over.id)
    if (!targetTask) return
    const targetCol = targetTask.column_id

    setTasks(prev => prev.map(t =>
      t.id === active.id ? { ...t, column_id: targetCol } : t
    ))
    await supabase.from('tasks').update({ column_id: targetCol, updated_at: new Date().toISOString() }).eq('id', active.id)
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
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
        <Button variant="accent" onClick={() => { setDefaultCol('todo'); setModalOpen(true) }}>
          <Plus size={13} /> Add Task
        </Button>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <KanbanColumn key={col.id} col={col} tasks={getColTasks(col.id)} onDelete={deleteTask} onAddClick={onAddClick} />
          ))}
        </div>
        <DragOverlay>
          {activeTask && (
            <div className="p-3 rounded-xl border shadow-2xl opacity-90 rotate-1"
              style={{ background: 'var(--surface2)', borderColor: 'var(--accent)', width: '240px' }}>
              <p className="text-xs">{activeTask.text}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Task">
        <div className="space-y-4">
          <Input label="Task" placeholder="What needs to be done?" value={form.text}
            onChange={e => setForm(p => ({ ...p, text: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addTask()} />
          <Select label="Column" value={defaultCol} onChange={e => setDefaultCol(e.target.value as ColumnId)}
            options={COLUMNS.map(c => ({ value: c.id, label: c.label }))} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tag" value={form.tag} onChange={e => setForm(p => ({ ...p, tag: e.target.value as Tag }))}
              options={TAG_OPTIONS} />
            <Select label="Priority" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as Priority }))}
              options={PRIORITY_OPTIONS} />
          </div>
          <Input label="Due Date (optional)" type="date" value={form.due_date}
            onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={addTask}>Add Task</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
