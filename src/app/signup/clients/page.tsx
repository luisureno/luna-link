'use client'

import { useEffect, useMemo , useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { SignupShell, StepIndicator } from '@/components/signup/SignupShell'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'

export default function ClientsStep() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { profile, loading: authLoading } = useAuth()

  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !profile) {
      router.replace('/login')
    }
  }, [authLoading, profile, router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Client name is required — or hit Skip to add one later.')
      return
    }
    if (!profile) return

    setSubmitting(true)
    const { error: insertError } = await supabase.from('clients').insert({
      company_id: profile.company_id,
      name: trimmed,
      contact_name: contactName.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_email: contactEmail.trim() || null,
      address: address.trim() || null,
    })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    router.push('/signup/done')
  }

  function handleSkip() {
    router.push('/signup/done')
  }

  if (authLoading || !profile) {
    return (
      <SignupShell>
        <div className="text-center text-sm text-gray-500">Loading…</div>
      </SignupShell>
    )
  }

  return (
    <SignupShell>
      <StepIndicator current={5} />
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">Add your first client</h1>
        <p className="mt-2 text-sm text-gray-600">Who are you hauling for? You'll invoice them later from their load tickets.</p>
      </div>

      <form onSubmit={handleSave} className="max-w-xl mx-auto bg-white border border-gray-200 rounded-xl p-6 md:p-8 space-y-4">
        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
        )}

        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <Building2 size={16} className="text-gray-700" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">Client details</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client name <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            placeholder="e.g. Desert Concrete Supply"
            className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact name</label>
            <input
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact email</label>
          <input
            type="email"
            value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
            placeholder="Where to send invoices"
            className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3">
            <Link href="/signup/team" className="text-sm text-gray-600 hover:text-gray-900">
              ← Back
            </Link>
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Skip for now
            </button>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-3 bg-[#1a1a1a] text-white rounded font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save & continue'}
          </button>
        </div>
      </form>
    </SignupShell>
  )
}
