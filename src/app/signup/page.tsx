'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'
import { SignupShell, StepIndicator } from '@/components/signup/SignupShell'
import { readSignupState, writeSignupState } from '@/lib/signup-state'
import type { PlanId, BillingCycle } from '@/types'

interface TierCard {
  id: PlanId
  name: string
  priceMonthly: number
  priceAnnualPerMonth: number
  blurb: string
  features: string[]
  highlight: boolean
}

const TIERS: TierCard[] = [
  {
    id: 'solo',
    name: 'Solo',
    priceMonthly: 29,
    priceAnnualPerMonth: 24,
    blurb: 'Owner operators running their own truck.',
    features: [
      '1 driver / 1 truck',
      'Combined owner + driver view',
      'Unlimited loads',
      'Tag scan + client invoicing',
      'Fuel + earnings tracking',
    ],
    highlight: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 79,
    priceAnnualPerMonth: 66,
    blurb: 'Small fleets with a dispatcher.',
    features: [
      'Up to 5 drivers / 5 trucks',
      'Full dispatcher dashboard',
      'Unlimited loads',
      'Tag scan + client invoicing',
      'Driver payroll',
    ],
    highlight: true,
  },
  {
    id: 'fleet',
    name: 'Fleet',
    priceMonthly: 149,
    priceAnnualPerMonth: 124,
    blurb: 'Growing fleets that need more hands on deck.',
    features: [
      'Up to 20 drivers / 20 trucks',
      'Everything in Starter',
      'Advanced reporting',
      'Bulk invoicing',
      'Priority support',
    ],
    highlight: false,
  },
]

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupShell><div className="text-center text-sm text-gray-500">Loading…</div></SignupShell>}>
      <SignupPlanPicker />
    </Suspense>
  )
}

function SignupPlanPicker() {
  const router = useRouter()
  const search = useSearchParams()
  const initialPlan = (search.get('plan') as PlanId | null) ?? 'starter'
  const [selected, setSelected] = useState<PlanId>(
    (['solo', 'starter', 'fleet'] as PlanId[]).includes(initialPlan) ? initialPlan : 'starter'
  )
  const [cycle, setCycle] = useState<BillingCycle>('monthly')

  useEffect(() => {
    const state = readSignupState()
    const q = search.get('plan') as PlanId | null
    if (q && (['solo', 'starter', 'fleet'] as PlanId[]).includes(q)) {
      setSelected(q)
    } else if (state.plan && (['solo', 'starter', 'fleet'] as PlanId[]).includes(state.plan)) {
      setSelected(state.plan)
    }
    if (state.cycle) setCycle(state.cycle)
  }, [search])

  function handleContinue() {
    writeSignupState({ plan: selected, cycle })
    router.push(`/signup/company?plan=${selected}&cycle=${cycle}`)
  }

  return (
    <SignupShell>
      <StepIndicator current={1} />
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">Choose your plan</h1>
        <p className="mt-2 text-sm text-gray-600">30-day free trial. No credit card required. Cancel anytime.</p>
      </div>

      {/* Billing cycle toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setCycle('monthly')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
              cycle === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setCycle('annual')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
              cycle === 'annual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Annual
            <span className="ml-1.5 text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">–2 mo</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {TIERS.map(tier => {
          const price = cycle === 'monthly' ? tier.priceMonthly : tier.priceAnnualPerMonth
          const isSelected = selected === tier.id
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelected(tier.id)}
              className={`relative text-left rounded-xl border-2 p-6 flex flex-col transition bg-white ${
                isSelected
                  ? 'border-[#1a1a1a] shadow-md'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              {tier.highlight && !isSelected && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-100 text-gray-700 text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full border border-gray-200">
                  Most popular
                </div>
              )}
              {isSelected && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-white text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
                  Selected
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{tier.blurb}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-gray-900">${price}</span>
                <span className="text-sm text-gray-500">/ month</span>
              </div>
              {cycle === 'annual' && (
                <p className="text-[11px] text-gray-500 mt-0.5">Billed ${price * 12}/year</p>
              )}
              <ul className="mt-5 space-y-2 flex-1">
                {tier.features.map((f, i) => (
                  <li key={i} className="flex gap-2 items-start text-sm text-gray-700">
                    <Check size={15} className="text-gray-900 mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      <div className="mt-6 text-center text-xs text-gray-500">
        Need unlimited drivers or custom integrations?{' '}
        <Link href="/#pricing" className="text-gray-900 font-medium underline">
          Contact sales for Enterprise
        </Link>
      </div>

      <div className="mt-10 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
        <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
          ← Back to home
        </Link>
        <button
          onClick={handleContinue}
          className="w-full sm:w-auto px-6 py-3 bg-[#1a1a1a] text-white rounded font-medium hover:bg-gray-800"
        >
          Continue
        </button>
      </div>
    </SignupShell>
  )
}

