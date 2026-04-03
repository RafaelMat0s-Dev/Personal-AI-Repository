import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), 'yyyy-MM-dd')
}

export function getWeekDays(date: Date = new Date()) {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end })
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export const TAG_COLORS: Record<string, string> = {
  work: 'bg-accent-2/15 text-accent-2',
  personal: 'bg-accent/15 text-accent',
  health: 'bg-accent-3/15 text-accent-3',
  study: 'bg-accent-4/15 text-accent-4',
  misc: 'bg-accent-5/15 text-accent-5',
}

export const PRIORITY_STYLES: Record<string, string> = {
  high: 'text-accent-3',
  mid: 'text-accent-5',
  low: 'text-dim',
}

export const PRIORITY_LABELS: Record<string, string> = {
  high: '● High',
  mid: '◐ Mid',
  low: '○ Low',
}

export const CAT_ICONS: Record<string, string> = {
  study: '📚',
  math: '🔢',
  science: '🔬',
  language: '🗣️',
  coding: '💻',
  other: '📌',
}

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export const EVENT_COLORS: Record<string, string> = {
  event: '#7b6cfa',
  reminder: '#fa6c6c',
  workout: '#c8fa5f',
  goal: '#fac86c',
}
