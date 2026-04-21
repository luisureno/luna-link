'use client'

import { useEffect, useMemo , useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { SignupShell, StepIndicator } from '@/components/signup/SignupShell'
import { readSignupState, writeSignupState } from '@/lib/signup-state'
import { createClient } from '@/lib/supabase/client'

export default function AccountStep() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const state = readSignupState()
    if (!state.plan) {
      router.replace('/signup')
      return
    }
    if (!state.company_name) {
      router.replace('/signup/company')
      return
    }
    if (state.owner_full_name) setFullName(state.owner_full_name)
    if (state.owner_email) setEmail(state.owner_email)
    if (state.owner_phone) setPhone(state.owner_phone)
    setHydrated(true)
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!fullName.trim() || !email.trim() || !password) {
      setError('Name, email, and password are required')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)
    const state = readSignupState()

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: state.plan,
        cycle: state.cycle,
        company_name: state.company_name,
        company_address: state.company_address,
        company_phone: state.company_phone,
        owner_full_name: fullName.trim(),
        owner_email: email.trim(),
        owner_phone: phone.trim() || undefined,
        password,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Signup failed')
      setSubmitting(false)
      return
    }

    writeSignupState({
      owner_full_name: fullName.trim(),
      owner_email: email.trim(),
      owner_phone: phone.trim() || undefined,
    })

    // Sign in the new user so subsequent steps run authenticated
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (signInError) {
      setError(`Account created, but sign-in failed: ${signInError.message}. Try logging in.`)
      setSubmitting(false)
      return
    }

    router.push('/signup/team')
  }

  if (!hydrated) {
    return (
      <SignupShell>
        <div className="text-center text-sm text-gray-500">Loading…</div>
      </SignupShell>
    )
  }

  return (
    <SignupShell>
      <StepIndicator current={3} />
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">Create your owner account</h1>
        <p className="mt-2 text-sm text-gray-600">You'll use this to log in and manage your fleet.</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto bg-white border border-gray-200 rounded-xl p-6 md:p-8 space-y-4">
        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your full name <span className="text-red-500">*</span>
          </label>
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            autoFocus
            placeholder="Jane Smith"
            className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Work email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@yourcompany.com"
            className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-900"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Minimum 8 characters.</p>
        </div>

        <div className="rounded-lg bg-[#F8F7F5] border border-gray-200 px-3 py-2.5 text-xs text-gray-600">
          <strong className="text-gray-900">30-day free trial</strong> starts today. No credit card required. You can add billing later.
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
          <Link href="/signup/company" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-3 bg-[#1a1a1a] text-white rounded font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? 'Creating account…' : 'Create account & start trial'}
          </button>
        </div>
      </form>
    </SignupShell>
  )
}
