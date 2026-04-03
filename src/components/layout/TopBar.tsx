'use client'

import { Sun, Moon, Bell } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useUIStore } from '@/store/ui'
import { Profile } from '@/types'
import { format } from 'date-fns'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/kanban': 'Kanban Board',
  '/dashboard/habits': 'Habit Tracker',
  '/dashboard/notes': 'Study Notes',
  '/dashboard/fitness': 'Nutrition & Fitness',
  '/dashboard/calendar': 'Calendar',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/weight': 'Weight Tracker',
  '/dashboard/settings': 'Settings',
}

export default function TopBar({ user }: { user: Profile }) {
  const pathname = usePathname()
  const { theme, toggleTheme } = useUIStore()
  const title = PAGE_TITLES[pathname] || 'Personal OS'

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 lg:px-8 h-16 border-b"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div>
        <h1 className="font-display font-extrabold text-lg leading-none">{title}</h1>
        <p className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: 'var(--text-dim)' }}>
          {format(new Date(), 'EEE, MMM d')}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-lg flex items-center justify-center border transition-all hover:scale-105"
          style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          className="w-9 h-9 rounded-lg flex items-center justify-center border transition-all hover:scale-105"
          style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          title="Notifications"
        >
          <Bell size={15} />
        </button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ml-1"
          style={{ background: 'var(--accent2)', color: 'white' }}>
          {(user.full_name || user.email || 'U')[0].toUpperCase()}
        </div>
      </div>
    </header>
  )
}
