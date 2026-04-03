'use client'

import { cn } from '@/lib/utils'
import { X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ReactNode, ButtonHTMLAttributes } from 'react'

// ─── Button ──────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'accent' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'default', size = 'md', loading, children, className, disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-mono rounded-lg border transition-all font-medium tracking-wide disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    default: 'border-[var(--border)] bg-[var(--surface2)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)]',
    accent: 'border-[var(--accent)] bg-[var(--accent)] text-[#0e0e10] hover:opacity-90',
    ghost: 'border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]',
    danger: 'border-[var(--accent3)] bg-transparent text-[var(--accent3)] hover:bg-[color-mix(in_srgb,var(--accent3)_10%,transparent)]',
  }
  const sizes = {
    sm: 'text-[10px] px-3 py-1.5',
    md: 'text-xs px-4 py-2',
    lg: 'text-sm px-5 py-2.5',
  }
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 size={12} className="animate-spin" />}
      {children}
    </button>
  )
}

// ─── Input ───────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}
export function Input({ label, className, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
          {label}
        </label>
      )}
      <input
        className={cn(
          'w-full px-3 py-2.5 rounded-lg text-xs border outline-none transition-colors',
          className
        )}
        style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
        {...props}
      />
    </div>
  )
}

// ─── Textarea ────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}
export function Textarea({ label, className, ...props }: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
          {label}
        </label>
      )}
      <textarea
        className={cn('w-full px-3 py-2.5 rounded-lg text-xs border outline-none transition-colors resize-none', className)}
        style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
        {...props}
      />
    </div>
  )
}

// ─── Select ──────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}
export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
          {label}
        </label>
      )}
      <select
        className={cn('w-full px-3 py-2.5 rounded-lg text-xs border outline-none transition-colors cursor-pointer', className)}
        style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
        {...props}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}
export function Modal({ open, onClose, title, children, width = 'max-w-md' }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', bounce: 0.25, duration: 0.35 }}
            className={cn('w-full rounded-2xl border p-6 shadow-2xl', width)}
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-extrabold text-lg">{title}</h2>
              <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                <X size={15} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Badge ───────────────────────────────────────────────────
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center text-[9px] px-2 py-0.5 rounded-full tracking-widest uppercase font-medium', className)}>
      {children}
    </span>
  )
}

// ─── Card ────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border', className)} style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 py-4 border-b flex items-center justify-between', className)}
      style={{ borderColor: 'var(--border)' }}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>
}
