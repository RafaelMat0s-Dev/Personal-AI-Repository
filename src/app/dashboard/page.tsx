import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'
import { CheckSquare, Flame, BookOpen, Dumbbell, Calendar, TrendingUp, ArrowRight } from 'lucide-react'

export default async function DashboardPage() {

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = format(new Date(), 'yyyy-MM-dd')
  const weekAgo = format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd')

  // Fetch quick stats in parallel
  const [
    { count: tasksDone },
    { data: habits },
    { data: habitLogs },
    { data: todayFood },
    { data: todayEvents },
  ] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('column_id', 'done'),
    supabase.from('habits').select('id').eq('user_id', user.id),
    supabase.from('habit_logs').select('*')
      .eq('user_id', user.id).gte('date', weekAgo).lte('date', today),
    supabase.from('food_logs').select('calories').eq('user_id', user.id).eq('date', today),
    supabase.from('events').select('*').eq('user_id', user.id).eq('date', today).order('time'),
  ])

  const todayCals = todayFood?.reduce((s, f) => s + (f.calories || 0), 0) || 0
  const habitCount = habits?.length || 0
  const doneToday = habitLogs?.filter(l => l.date === today && l.done).length || 0
  const habitPct = habitCount > 0 ? Math.round(doneToday / habitCount * 100) : 0

  const quickLinks = [
    { href: '/dashboard/kanban', icon: CheckSquare, label: 'Kanban', color: 'var(--accent2)', desc: `${tasksDone || 0} tasks done` },
    { href: '/dashboard/habits', icon: Flame, label: 'Habits', color: 'var(--accent5)', desc: `${habitPct}% today` },
    { href: '/dashboard/notes', icon: BookOpen, label: 'Notes', color: 'var(--accent4)', desc: 'Study notes' },
    { href: '/dashboard/fitness', icon: Dumbbell, label: 'Fitness', color: 'var(--accent3)', desc: `${todayCals} kcal today` },
    { href: '/dashboard/calendar', icon: Calendar, label: 'Calendar', color: 'var(--accent)', desc: `${todayEvents?.length || 0} events today` },
    { href: '/dashboard/analytics', icon: TrendingUp, label: 'Analytics', color: 'var(--accent2)', desc: 'Weekly insights' },
  ]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Greeting */}
      <div className="mb-10">
        <p className="text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
          {format(new Date(), 'EEEE, MMMM d')}
        </p>
        <h1 className="font-display font-extrabold text-4xl">Good {getGreeting()} 👋</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
          Here&apos;s your overview for today
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Tasks Done" value={String(tasksDone || 0)} color="var(--accent2)" icon="✓" />
        <StatCard label="Habits Today" value={`${doneToday}/${habitCount}`} color="var(--accent5)" icon="🔥" />
        <StatCard label="Calories" value={String(todayCals)} color="var(--accent3)" icon="🍽️" />
      </div>

      {/* Module Grid */}
      <h2 className="font-display font-bold text-lg mb-4">Quick Access</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {quickLinks.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="group p-5 rounded-xl border transition-all hover:scale-[1.02]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${link.color} 15%, transparent)` }}>
                <link.icon size={18} style={{ color: link.color }} />
              </div>
              <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="font-display font-bold text-sm">{link.label}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{link.desc}</div>
          </Link>
        ))}
      </div>

      {/* Today's Events */}
      {todayEvents && todayEvents.length > 0 && (
        <div>
          <h2 className="font-display font-bold text-lg mb-4">Today&apos;s Schedule</h2>
          <div className="space-y-2">
            {todayEvents.map((ev: { id: string; time?: string; title: string; type: string; color: string }) => (
              <div key={ev.id} className="flex items-center gap-4 p-4 rounded-xl border"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: ev.color }} />
                <div>
                  <div className="text-sm font-medium">{ev.title}</div>
                  {ev.time && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{ev.time}</div>
                  )}
                </div>
                <span className="ml-auto text-xs px-2 py-1 rounded-full capitalize"
                  style={{ background: `color-mix(in srgb, ${ev.color} 15%, transparent)`, color: ev.color }}>
                  {ev.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <div className="p-5 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <div className="font-display font-extrabold text-3xl" style={{ color }}>{value}</div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
