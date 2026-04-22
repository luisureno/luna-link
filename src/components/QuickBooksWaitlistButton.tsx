'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export function QuickBooksWaitlistButton({ source = 'invoices_page' }: { source?: string }) {
  const { profile, supabaseUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [fleetSize, setFleetSize] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function openModal() {
    setEmail(supabaseUser?.email ?? '')
    setFleetSize('')
    setError('')
    setSuccess(false)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/quickbooks-waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        fleet_size: fleetSize,
        company_id: profile?.company_id,
        user_id: profile?.id,
        source,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong.')
      setSubmitting(false)
      return
    }
    setSuccess(true)
    setSubmitting(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 bg-white rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <span className="w-5 h-5 rounded bg-[#2ca01c] text-white flex items-center justify-center text-[10px] font-bold">qb</span>
        QuickBooks
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            {success ? (
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Check className="text-green-600" size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">You're on the list</h3>
                <p className="text-sm text-gray-600 mb-6">
                  We'll email you the moment the QuickBooks integration ships.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 bg-[#1a1a1a] text-white rounded text-sm font-medium hover:bg-gray-800"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded bg-[#2ca01c] text-white flex items-center justify-center text-[11px] font-bold">qb</span>
                  <h3 className="text-lg font-semibold text-gray-900">QuickBooks integration</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Push invoices and payroll directly into QuickBooks. It's in development — join the waitlist and we'll let you know the day it ships.
                </p>

                {error && (
                  <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fleet size</label>
                    <select
                      required
                      value={fleetSize}
                      onChange={e => setFleetSize(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="">Select…</option>
                      <option value="1">1 truck (owner-operator)</option>
                      <option value="2-5">2–5 trucks</option>
                      <option value="6-15">6–15 trucks</option>
                      <option value="16-50">16–50 trucks</option>
                      <option value="50+">50+ trucks</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="flex-1 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-2 bg-[#1a1a1a] text-white rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                    >
                      {submitting ? 'Joining…' : 'Join waitlist'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
