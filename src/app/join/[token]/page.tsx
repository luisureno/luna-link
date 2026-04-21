'use client'

import { useEffect, useMemo , useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function JoinPage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [companyName, setCompanyName] = useState<string | null>(null)
  const [invalidToken, setInvalidToken] = useState(false)
  const [checking, setChecking] = useState(true)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [truckNumber, setTruckNumber] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function validate() {
      const res = await fetch(`/api/join?token=${encodeURIComponent(token)}`)
      if (!res.ok) {
        setInvalidToken(true)
      } else {
        const data = await res.json()
        setCompanyName(data.company_name)
      }
      setChecking(false)
    }
    validate()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        email,
        password,
        full_name: fullName,
        phone,
        truck_number: truckNumber,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Registration failed')
      setSubmitting(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError('Account created but sign in failed. Try the login page.')
      setSubmitting(false)
      return
    }

    router.push('/driver')
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F5]">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    )
  }

  if (invalidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F5] p-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Invalid invite link</h1>
          <p className="text-sm text-gray-500 mb-6">This link is no longer valid. Ask your dispatcher for a new one.</p>
          <Link href="/" className="text-sm text-gray-900 underline">Back to home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7F5] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Join {companyName}</h1>
          <p className="text-sm text-gray-500 mt-1">Create your driver account</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Truck Number</label>
              <input
                type="text"
                value={truckNumber}
                onChange={e => setTruckNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="T-104"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-[#1a1a1a] text-white text-sm font-medium rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
