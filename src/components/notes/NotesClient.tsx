'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Note, NoteCategory } from '@/types'
import { CAT_ICONS, cn } from '@/lib/utils'
import { Button, Select } from '@/components/ui'
import { Plus, Pin, PinOff, Trash2, Bold, Italic, Code, List, Quote } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

const CAT_OPTIONS = [
  { value: 'study', label: '📚 Study' },
  { value: 'math', label: '🔢 Math' },
  { value: 'science', label: '🔬 Science' },
  { value: 'language', label: '🗣️ Language' },
  { value: 'coding', label: '💻 Coding' },
  { value: 'other', label: '📌 Other' },
]

const CAT_BADGE: Record<string, string> = {
  study: 'bg-[color-mix(in_srgb,var(--accent4)_15%,transparent)] text-[var(--accent4)]',
  math: 'bg-[color-mix(in_srgb,var(--accent2)_15%,transparent)] text-[var(--accent2)]',
  science: 'bg-[color-mix(in_srgb,var(--accent3)_15%,transparent)] text-[var(--accent3)]',
  language: 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]',
  coding: 'bg-[color-mix(in_srgb,var(--accent5)_15%,transparent)] text-[var(--accent5)]',
  other: 'bg-[color-mix(in_srgb,var(--text-muted)_15%,transparent)] text-[var(--text-muted)]',
}

export default function NotesClient({ initialNotes, userId }: { initialNotes: Note[]; userId: string }) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [activeId, setActiveId] = useState<string | null>(notes[0]?.id || null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string>('all')
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()
  const supabase = createClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeNote = notes.find(n => n.id === activeId)

  const filtered = notes.filter(n => {
    const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || n.category === catFilter
    return matchSearch && matchCat
  })

  async function newNote() {
    const note: Note = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: '',
      content: '',
      category: 'study',
      tags: [],
      pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setNotes(prev => [note, ...prev])
    setActiveId(note.id)
    const { error } = await supabase.from('notes').insert(note)
    if (error) toast.error('Failed to create note')
  }

  const saveNote = useCallback(async (id: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updated_at: new Date().toISOString() } : n))
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      await supabase.from('notes').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    }, 600)
  }, [supabase])

  async function deleteNote(id: string) {
    const idx = notes.findIndex(n => n.id === id)
    setNotes(prev => prev.filter(n => n.id !== id))
    const remaining = notes.filter(n => n.id !== id)
    setActiveId(remaining[Math.max(0, idx - 1)]?.id || null)
    await supabase.from('notes').delete().eq('id', id)
    toast.success('Note deleted')
  }

  async function togglePin(id: string) {
    const note = notes.find(n => n.id === id)
    if (!note) return
    await saveNote(id, { pinned: !note.pinned })
    setNotes(prev => [...prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n)]
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)))
  }

  function insertText(before: string, after = '') {
    const ta = textareaRef.current
    if (!ta || !activeNote) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const sel = ta.value.substring(start, end)
    const newVal = ta.value.substring(0, start) + before + sel + after + ta.value.substring(end)
    saveNote(activeNote.id, { content: newVal })
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = start + before.length
      ta.selectionEnd = start + before.length + sel.length
    }, 0)
  }

  return (
    <div className="flex gap-5 h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="w-64 flex flex-col rounded-xl border overflow-hidden flex-shrink-0"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="px-4 py-3.5 border-b space-y-2.5" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-sm">Notes</span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{notes.length}</span>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full px-3 py-2 rounded-lg text-xs border outline-none"
            style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none cursor-pointer"
            style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="all">All categories</option>
            {CAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <Button variant="ghost" size="sm" onClick={newNote} className="w-full mb-2 justify-start border-dashed border"
            style={{ borderColor: 'var(--border)' }}>
            <Plus size={12} /> New note
          </Button>
          <AnimatePresence>
            {filtered.map(note => (
              <motion.button
                key={note.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onClick={() => setActiveId(note.id)}
                className={cn(
                  'w-full text-left p-3 rounded-xl mb-1.5 border transition-all',
                  activeId === note.id ? 'border-[var(--border)]' : 'border-transparent hover:border-[var(--border)]'
                )}
                style={{ background: activeId === note.id ? 'var(--surface2)' : 'transparent' }}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span className="text-xs font-medium truncate">{note.title || 'Untitled'}</span>
                  {note.pinned && <Pin size={10} style={{ color: 'var(--accent5)', flexShrink: 0 }} />}
                </div>
                <p className="text-[10px] truncate mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {note.content.replace(/[#*`>]/g, '').substring(0, 50) || 'Empty note'}
                </p>
                <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full tracking-widest uppercase', CAT_BADGE[note.category])}>
                  {CAT_ICONS[note.category]} {note.category}
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Editor */}
      {activeNote ? (
        <div className="flex-1 flex flex-col rounded-xl border overflow-hidden"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          {/* Editor header */}
          <div className="px-5 py-3.5 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
            <input
              value={activeNote.title}
              onChange={e => saveNote(activeNote.id, { title: e.target.value })}
              placeholder="Note title..."
              className="flex-1 bg-transparent text-lg font-display font-bold outline-none"
              style={{ color: 'var(--text)' }}
            />
            <Select value={activeNote.category}
              onChange={e => saveNote(activeNote.id, { category: e.target.value as NoteCategory })}
              options={CAT_OPTIONS} className="w-36 text-[10px] py-1.5" />
            <button onClick={() => togglePin(activeNote.id)} className="p-1.5 rounded-lg transition-all"
              style={{ color: activeNote.pinned ? 'var(--accent5)' : 'var(--text-muted)' }}>
              {activeNote.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
            <button onClick={() => deleteNote(activeNote.id)} className="p-1.5 rounded-lg transition-all"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent3)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
              <Trash2 size={14} />
            </button>
          </div>

          {/* Toolbar */}
          <div className="px-5 py-2 border-b flex gap-1 flex-wrap" style={{ borderColor: 'var(--border)' }}>
            {[
              { icon: Bold, action: () => insertText('**', '**'), title: 'Bold' },
              { icon: Italic, action: () => insertText('*', '*'), title: 'Italic' },
              { icon: Code, action: () => insertText('`', '`'), title: 'Code' },
              { icon: List, action: () => insertText('\n- '), title: 'List' },
              { icon: Quote, action: () => insertText('\n> '), title: 'Quote' },
            ].map(({ icon: Icon, action, title }) => (
              <button key={title} onClick={action} title={title}
                className="p-1.5 rounded-md text-xs transition-all"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                <Icon size={14} />
              </button>
            ))}
            {['H1', 'H2', 'H3'].map(h => (
              <button key={h} onClick={() => insertText(`\n${'#'.repeat(parseInt(h[1]))} `)}
                className="p-1.5 rounded-md text-[10px] font-bold transition-all"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                {h}
              </button>
            ))}
            <span className="ml-auto text-[10px] self-center" style={{ color: 'var(--text-dim)' }}>
              {format(new Date(activeNote.updated_at), 'MMM d, HH:mm')}
            </span>
          </div>

          {/* Textarea */}
          <div className="flex-1 overflow-y-auto p-5">
            <textarea
              ref={textareaRef}
              value={activeNote.content}
              onChange={e => saveNote(activeNote.id, { content: e.target.value })}
              placeholder="Start writing... (supports markdown)"
              className="w-full h-full bg-transparent outline-none resize-none leading-relaxed text-sm"
              style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-mono)', minHeight: '400px' }}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center flex-col gap-4 rounded-xl border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="text-4xl">📓</div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Select or create a note</div>
          <Button variant="accent" onClick={newNote}><Plus size={13} /> New Note</Button>
        </div>
      )}
    </div>
  )
}
