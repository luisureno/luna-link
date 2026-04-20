'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { SignupShell, StepIndicator } from '@/components/signup/SignupShell'
import { readSignupState, writeSignupState } from '@/lib/signup-state'
import type { PlanId, BillingCycle } from '@/types'

export default function CompanyStep() {
  return (
    <Suspense fallback={<SignupShell><div className="text-center text-sm text-gray-500">Loading…</div></SignupShell>}>
      <CompanyForm />
    </Suspense>
  )
}

function CompanyForm() {
  const router = useRouter()
  const search = useSearchParams()

  const [companyName, setCompanyName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [fleetSize, setFleetSize] = useState('')
  const [error, setError] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const state = readSignupState()
    const plan = (search.get('plan') as PlanId | null) ?? state.plan
    const cycle = (search.get('cycle') as BillingCycle | null) ?? state.cycle

    if (!plan) {
      router.replace('/signup')
      return
    }
    writeSignupState({ plan, cycle: cycle ?? 'monthly' })

    if (state.company_name) setCompanyName(state.company_name)
    if (state.company_address) setAddress(state.company_address)
    if (state.company_phone) setPhone(state.company_phone)
    if (state.fleet_size) setFleetSize(state.fleet_size)
    setHydrated(true)
  }, [router, search])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const trimmed = companyName.trim()
    if (!trimmed) {
      setError('Company name is required')
      return
    }
    writeSignupState({
      company_name: trimmed,
      company_address: address.trim() || undefined,
      company_phone: phone.trim() || undefined,
      fleet_size: fleetSize || undefined,
    })
    router.push('/signup/account')
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
      <StepIndicator current={2} />
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">Tell us about your company</h1>
        <p className="mt-2 text-sm text-gray-600">This shows up on invoices and your dispatcher dashboard.</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto bg-white border border-gray-200 rounded-xl p-6 md:p-8 space-y-4">
        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company name <span className="text-red-500">*</span>
          </label>
          <input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            autoFocus
            placeholder="e.g. Mesa Rock Hauling"
            className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business address</label>
          <input
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Street, city, state"
            className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business phone</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fleet size</label>
          <select
            value={fleetSize}
            onChange={e => setFleetSize(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">Select…</option>
            <option value="1">Just me (1 truck)</option>
            <option value="2-5">2–5 trucks</option>
            <option value="6-15">6–15 trucks</option>
            <option value="16-50">16–50 trucks</option>
            <option value="50+">50+ trucks</option>
          </select>
          <p className="text-[11px] text-gray-500 mt-1">Helps us size your dashboard. You can invite drivers later.</p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
          <Link href="/signup" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back
          </Link>
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-3 bg-[#1a1a1a] text-white rounded font-medium hover:bg-gray-800"
          >
            Continue
          </button>
        </div>
      </form>
    </SignupShell>
  )
}
