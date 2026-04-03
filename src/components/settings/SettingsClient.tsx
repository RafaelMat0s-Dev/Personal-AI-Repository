'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardBody, Button, Input } from '@/components/ui'
import { Eye, EyeOff, Loader2, KeyRound, User, CheckCircle } from 'lucide-react'
import { Profile } from '@/types'
import toast from 'react-hot-toast'

export default function SettingsClient({ user }: { user: Profile }) {
  const supabase = createClient()

  // ── Profile form ─────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    full_name: user.full_name || '',
  })
  const [profileLoading, setProfileLoading] = useState(false)

  // ── Password form ────────────────────────────────────────
  const [pwForm, setPwForm] = useState({
    current: '',
    next: '',
    confirm: '',
  })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)

  // ── Validation ───────────────────────────────────────────
  const passwordsMatch = pwForm.next === pwForm.confirm
  const passwordLongEnough = pwForm.next.length >= 6
  const canSubmit = pwForm.next && pwForm.confirm && passwordsMatch && passwordLongEnough

  const strength = (() => {
    const p = pwForm.next
    if (!p) return 0
    let s = 0
    if (p.length >= 8) s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    return s
  })()

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength]
  const strengthColor = ['', 'var(--accent3)', 'var(--accent5)', 'var(--accent4)', 'var(--accent)'][strength]

  // ── Handlers ─────────────────────────────────────────────
  async function updateProfile() {
    setProfileLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: profileForm.full_name })
      .eq('id', user.id)
    setProfileLoading(false)
    if (error) toast.error(error.message)
    else toast.success('Profile updated!')
  }

  async function changePassword() {
    if (!canSubmit) return

    if (!passwordsMatch) {
      toast.error('Passwords do not match')
      return
    }

    setPwLoading(true)
    setPwSuccess(false)

    // Supabase updateUser changes the password directly for logged-in users
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })

    setPwLoading(false)

    if (error) {
      toast.error(error.message)
    } else {
      setPwSuccess(true)
      setPwForm({ current: '', next: '', confirm: '' })
      toast.success('Password changed successfully!')
      setTimeout(() => setPwSuccess(false), 4000)
    }
  }

  return (
    <div className="max-w-xl space-y-6">

      {/* Profile section */}
      <Card>
        <CardHeader>
          <span className="font-display font-bold text-sm flex items-center gap-2">
            <User size={15} style={{ color: 'var(--accent2)' }} /> Profile
          </span>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Email
            </label>
            <div className="px-3 py-2.5 rounded-lg text-xs border"
              style={{ background: 'var(--surface3)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              {user.email}
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>
              Email cannot be changed here
            </p>
          </div>

          <Input
            label="Full Name"
            value={profileForm.full_name}
            onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
            placeholder="Your name"
            onKeyDown={e => e.key === 'Enter' && updateProfile()}
          />

          <div className="flex justify-end">
            <Button variant="accent" onClick={updateProfile} loading={profileLoading}>
              Save Profile
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Password section */}
      <Card>
        <CardHeader>
          <span className="font-display font-bold text-sm flex items-center gap-2">
            <KeyRound size={15} style={{ color: 'var(--accent5)' }} /> Change Password
          </span>
        </CardHeader>
        <CardBody className="space-y-4">

          {/* New password */}
          <div>
            <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
              New Password
            </label>
            <div className="relative">
              <input
                type={showNext ? 'text' : 'password'}
                value={pwForm.next}
                onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                placeholder="Min. 6 characters"
                className="w-full px-3 py-2.5 rounded-lg text-xs border outline-none transition-colors pr-10"
                style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
              <button type="button" onClick={() => setShowNext(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--text-muted)' }}>
                {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* Strength meter */}
            {pwForm.next && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-1 flex-1 rounded-full transition-all"
                      style={{ background: i <= strength ? strengthColor : 'var(--surface3)' }} />
                  ))}
                </div>
                <p className="text-[10px]" style={{ color: strengthColor }}>
                  {strengthLabel}
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={pwForm.confirm}
                onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                placeholder="Repeat new password"
                className="w-full px-3 py-2.5 rounded-lg text-xs border outline-none transition-colors pr-10"
                style={{
                  background: 'var(--surface2)',
                  borderColor: pwForm.confirm && !passwordsMatch ? 'var(--accent3)' : 'var(--border)',
                  color: 'var(--text)'
                }}
                onFocus={e => (e.target.style.borderColor = passwordsMatch ? 'var(--accent)' : 'var(--accent3)')}
                onBlur={e => (e.target.style.borderColor = pwForm.confirm && !passwordsMatch ? 'var(--accent3)' : 'var(--border)')}
                onKeyDown={e => e.key === 'Enter' && changePassword()}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--text-muted)' }}>
                {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {pwForm.confirm && !passwordsMatch && (
              <p className="text-[10px] mt-1" style={{ color: 'var(--accent3)' }}>
                Passwords do not match
              </p>
            )}
            {pwForm.confirm && passwordsMatch && (
              <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                <CheckCircle size={11} /> Passwords match
              </p>
            )}
          </div>

          {/* Success banner */}
          {pwSuccess && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-xs"
              style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
              <CheckCircle size={14} />
              Password changed successfully!
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              variant="accent"
              onClick={changePassword}
              loading={pwLoading}
              disabled={!canSubmit || pwLoading}
            >
              {pwLoading ? 'Updating...' : 'Change Password'}
            </Button>
          </div>
        </CardBody>
      </Card>

    </div>
  )
}
