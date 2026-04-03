'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Columns3, Flame, BookOpen, Dumbbell, Calendar, TrendingUp, Scale, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Profile } from '@/types'
import { motion } from 'framer-motion'

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview', exact: true },
  { href: '/dashboard/kanban', icon: Columns3, label: 'Kanban' },
  { href: '/dashboard/habits', icon: Flame, label: 'Habits' },
  { href: '/dashboard/notes', icon: BookOpen, label: 'Notes' },
  { href: '/dashboard/fitness', icon: Dumbbell, label: 'Fitness' },
  { href: '/dashboard/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/dashboard/analytics', icon: TrendingUp, label: 'Analytics' },
  { href: '/dashboard/weight', icon: Scale, label: 'Weight' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar({ user }: { user: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 bottom-0 w-[220px] flex flex-col border-r z-50"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="px-6 py-7 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--accent)', color: '#0e0e10' }}>P</div>
          <div>
            <div className="font-display font-extrabold text-sm leading-tight">Personal OS</div>
            <div className="text-[9px] tracking-[2px] uppercase mt-0.5" style={{ color: 'var(--text-dim)' }}>
              command center
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(item => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-all relative',
                active
                  ? 'font-medium'
                  : 'hover:opacity-100'
              )}
              style={{
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                background: active ? 'var(--surface2)' : 'transparent',
              }}
            >
              {active && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'var(--surface2)' }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <item.icon size={15} className="relative z-10 flex-shrink-0" />
              <span className="relative z-10">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 pb-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--accent2)', color: 'white' }}>
            {(user.full_name || user.email || 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{user.full_name || 'User'}</div>
            <div className="text-[10px] truncate" style={{ color: 'var(--text-dim)' }}>{user.email}</div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-all"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent3)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </motion.aside>
  )
}
