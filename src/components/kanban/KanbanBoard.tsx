'use client'

import { useState } from 'react'
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
  useDroppable,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { Task, ColumnId, ViewType, Tag, Priority } from '@/types'
import { TAG_COLORS, PRIORITY_LABELS, PRIORITY_STYLES, cn } from '@/lib/utils'
import { Button, Modal, Input, Select, Badge } from '@/components/ui'
import { Plus, GripVertical, Pencil } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const COLUMNS: { id: ColumnId; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog',     color: 'var(--text-dim)' },
  { id: 'todo',    label: 'To Do',       color: 'var(--accent4)'  },
  { id: 'inprogress', label: 'In Progress', color: 'var(--accent5)' },
  { id: 'done',    label: 'Done',        color: 'var(--accent)'   },
]

const TAG_OPTIONS      = ['work','personal','health','study','misc'].map(v => ({ value: v, label: v }))
const PRIORITY_OPTIONS = [
  { value: 'high', label: '🔴 High' },
  { value: 'mid',  label: '🟡 Mid'  },
  { value: 'low',  label: '⚪ Low'  },
]

// ─── Task Card ───────────────────────────────────────────────
function TaskCard({
  task, onDelete, onEdit,
}: {
  task: Task
  onDelete: (id: string) => void
  onEdit:   (task: Task) => void
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, background: 'var(--surface2)', borderColor: 'var(--border)' }}
      className="group rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="p-3 rounded-xl border" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
        <div className="flex items-start gap-2 mb-2.5">
          {/* Drag handle only — does NOT wrap the whole card */}
          <div
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 touch-none"
            style={{ color: 'var(--text-dim)' }}
          >
            <GripVertical size={13} />
          </div>

          <p className="flex-1 text-xs leading-relaxed">{task.text}</p>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onEdit(task) }}
              style={{ color: 'var(--text-dim)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent2)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(task.id) }}
              className="text-xs"
              style={{ color: 'var(--text-dim)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent3)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
            >×</button>
          </div>
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

// ─── Droppable Column ────────────────────────────────────────
function KanbanColumn({
  col, tasks, onDelete, onEdit, onAddClick,
}: {
  col: { id: ColumnId; label: string; color: string }
  tasks: Task[]
  onDelete: (id: string) => void
  onEdit:   (task: Task) => void
  onAddClick: (colId: ColumnId) => void
}) {
  // Make the whole column a drop target so cards can be dropped onto empty columns
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div
      className="flex flex-col rounded-xl border overflow-hidden transition-colors"
      style={{
        background: isOver ? 'color-mix(in srgb, var(--accent) 4%, var(--surface))' : 'var(--surface)',
        borderColor: isOver ? 'var(--accent)' : 'var(--border)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
          <span className="font-display font-bold text-xs tracking-wider uppercase" style={{ color: col.color }}>
            {col.label}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}>
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

      {/* Cards */}
      <div ref={setNodeRef} className="flex-1 p-3 space-y-2 min-h-[120px]">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onDelete={onDelete} onEdit={onEdit} />
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

// ─── Main Board ──────────────────────────────────────────────
export default function KanbanBoard({ initialTasks, userId }: { initialTasks: Task[]; userId: string }) {
  const [tasks,      setTasks]      = useState<Task[]>(initialTasks)
  const [view,       setView]       = useState<ViewType>('weekly')
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  // Add / Edit modal shared state
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editingTask,  setEditingTask]  = useState<Task | null>(null)
  const [defaultCol,   setDefaultCol]   = useState<ColumnId>('todo')
  const [form, setForm] = useState<{
    text: string; tag: Tag; priority: Priority; due_date: string; column_id: ColumnId
  }>({ text: '', tag: 'misc', priority: 'mid', due_date: '', column_id: 'todo' })

  const supabase = createClient()
  const filtered = tasks.filter(t => t.view_type === view)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function getColTasks(colId: ColumnId) {
    return filtered.filter(t => t.column_id === colId)
  }

  // ── Open add modal ────────────────────────────────────────
  function openAdd(colId: ColumnId = 'todo') {
    setEditingTask(null)
    setDefaultCol(colId)
    setForm({ text: '', tag: 'misc', priority: 'mid', due_date: '', column_id: colId })
    setModalOpen(true)
  }

  // ── Open edit modal ───────────────────────────────────────
  function openEdit(task: Task) {
    setEditingTask(task)
    setForm({
      text:      task.text,
      tag:       task.tag,
      priority:  task.priority,
      due_date:  task.due_date || '',
      column_id: task.column_id,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingTask(null)
  }

  // ── Save (add or edit) ────────────────────────────────────
  async function saveTask() {
    if (!form.text.trim()) return

    if (editingTask) {
      // Edit existing
      const updated: Task = {
        ...editingTask,
        text:      form.text,
        tag:       form.tag,
        priority:  form.priority,
        due_date:  form.due_date || undefined,
        column_id: form.column_id,
        updated_at: new Date().toISOString(),
      }
      setTasks(prev => prev.map(t => t.id === editingTask.id ? updated : t))
      closeModal()
      const { error } = await supabase.from('tasks').update({
        text:      updated.text,
        tag:       updated.tag,
        priority:  updated.priority,
        due_date:  updated.due_date ?? null,
        column_id: updated.column_id,
        updated_at: updated.updated_at,
      }).eq('id', editingTask.id)
      if (error) toast.error('Failed to update task')
      else toast.success('Task updated!')
    } else {
      // Add new
      const newTask: Omit<Task, 'created_at' | 'updated_at'> = {
        id:        crypto.randomUUID(),
        user_id:   userId,
        text:      form.text,
        column_id: form.column_id,
        view_type: view,
        tag:       form.tag,
        priority:  form.priority,
        due_date:  form.due_date || undefined,
        position:  getColTasks(form.column_id).length,
      }
      setTasks(prev => [...prev, newTask as Task])
      closeModal()
      const { error } = await supabase.from('tasks').insert(newTask)
      if (error) toast.error('Failed to save task')
      else toast.success('Task added!')
    }
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
    toast.success('Task deleted')
  }

  // ── Drag ─────────────────────────────────────────────────
  function onDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find(t => t.id === e.active.id) || null)
  }

  // onDragOver: move card into new column in real-time while dragging
  function onDragOver(e: DragEndEvent) {
    const { active, over } = e
    if (!over) return

    const activeId = active.id as string
    const overId   = over.id   as string

    if (activeId === overId) return

    // Is the over target a column id?
    const overIsColumn = COLUMNS.some(c => c.id === overId)
    const targetCol = overIsColumn
      ? (overId as ColumnId)
      : tasks.find(t => t.id === overId)?.column_id

    if (!targetCol) return

    setTasks(prev => prev.map(t =>
      t.id === activeId ? { ...t, column_id: targetCol } : t
    ))
  }

  // onDragEnd: persist the final column to Supabase
  async function onDragEnd(e: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = e
    if (!over) return

    const activeId = active.id as string
    const overId   = over.id   as string
    const task     = tasks.find(t => t.id === activeId)
    if (!task) return

    // Persist whatever column the card ended up in
    await supabase
      .from('tasks')
      .update({ column_id: task.column_id, updated_at: new Date().toISOString() })
      .eq('id', activeId)
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 p-1 rounded-lg border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          {(['weekly', 'daily'] as ViewType[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-4 py-1.5 rounded-md text-xs transition-all capitalize font-medium"
              style={{
                background: view === v ? 'var(--surface3)' : 'transparent',
                color:      view === v ? 'var(--accent)'   : 'var(--text-muted)',
              }}>
              {v}
            </button>
          ))}
        </div>
        <Button variant="accent" onClick={() => openAdd('todo')}>
          <Plus size={13} /> Add Task
        </Button>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              col={col}
              tasks={getColTasks(col.id)}
              onDelete={deleteTask}
              onEdit={openEdit}
              onAddClick={openAdd}
            />
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

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingTask ? 'Edit Task' : 'Add Task'}
      >
        <div className="space-y-4">
          <Input
            label="Task"
            placeholder="What needs to be done?"
            value={form.text}
            onChange={e => setForm(p => ({ ...p, text: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && saveTask()}
            autoFocus
          />
          <Select
            label="Column"
            value={form.column_id}
            onChange={e => setForm(p => ({ ...p, column_id: e.target.value as ColumnId }))}
            options={COLUMNS.map(c => ({ value: c.id, label: c.label }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tag"
              value={form.tag}
              onChange={e => setForm(p => ({ ...p, tag: e.target.value as Tag }))}
              options={TAG_OPTIONS}
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={e => setForm(p => ({ ...p, priority: e.target.value as Priority }))}
              options={PRIORITY_OPTIONS}
            />
          </div>
          <Input
            label="Due Date (optional)"
            type="date"
            value={form.due_date}
            onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            {editingTask && (
              <Button variant="danger" onClick={() => { deleteTask(editingTask.id); closeModal() }}>
                Delete
              </Button>
            )}
            <Button onClick={closeModal}>Cancel</Button>
            <Button variant="accent" onClick={saveTask}>
              {editingTask ? 'Save Changes' : 'Add Task'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
