'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Sparkles, ArrowRight } from 'lucide-react'
import { SignupShell, StepIndicator } from '@/components/signup/SignupShell'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { clearSignupState } from '@/lib/signup-state'
import { daysLeftInTrial } from '@/lib/plan-limits'
import type { AccountType } from '@/types'

export default function DoneStep() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { profile, loading: authLoading } = useAuth()

  const [companyName, setCompanyName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('fleet')
  const [planName, setPlanName] = useState('')
  const [daysLeft, setDaysLeft] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!profile) {
      router.replace('/login')
      return
    }

    async function finalize() {
      const { data: company } = await supabase
        .from('companies')
        .select('name, account_type, plan_id, trial_ends_at')
        .eq('id', profile!.company_id)
        .single()

      if (company) {
        setCompanyName(company.name)
        setAccountType((company.account_type ?? 'fleet') as AccountType)
        setDaysLeft(daysLeftInTrial(company.trial_ends_at))

        if (company.plan_id) {
          const { data: plan } = await supabase
            .from('plans')
            .select('name')
            .eq('id', company.plan_id)
            .single()
          if (plan) setPlanName(plan.name)
        }
      }

      await supabase
        .from('onboarding_progress')
        .update({ current_step: 6, completed: true, updated_at: new Date().toISOString() })
        .eq('company_id', profile!.company_id)

      clearSignupState()
      setLoading(false)
    }

    finalize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, profile?.company_id])

  const dashboardHref = accountType === 'solo' ? '/dashboard/solo' : '/dashboard'

  if (loading) {
    return (
      <SignupShell>
        <div className="text-center text-sm text-gray-500">Finalizing…</div>
      </SignupShell>
    )
  }

  return (
    <SignupShell>
      <StepIndicator current={6} />

      <div className="max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-5">
          <CheckCircle2 className="text-green-600" size={36} />
        </div>

        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">
          Welcome to fleetwise{companyName ? `, ${companyName}` : ''}.
        </h1>
        <p className="mt-3 text-sm md:text-base text-gray-600">
          Your account is live. {planName && <>You're on the <strong className="text-gray-900">{planName}</strong> plan.</>}
        </p>

        {daysLeft !== null && daysLeft > 0 && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1a1a1a] text-white px-4 py-2 text-sm font-medium">
            <Sparkles size={14} />
            {daysLeft} day{daysLeft === 1 ? '' : 's'} left in your free trial
          </div>
        )}

        <div className="mt-10 bg-white border border-gray-200 rounded-xl p-6 md:p-8 text-left">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">What's next</h2>
          <ul className="space-y-3">
            {(accountType === 'solo'
              ? [
                  'Run a pre-trip and check in for your first load',
                  'Snap a tag photo — AI fills the ticket for you',
                  'Add fuel receipts as you go — we track the cost',
                  'Invoice your client at the end of the week',
                ]
              : [
                  'Share your driver invite link from Settings → Users',
                  'Create a ticket template that matches your paperwork',
                  'Dispatch your first load when your drivers are onboarded',
                  'Add billing info before your trial ends to keep running',
                ]
            ).map((item, i) => (
              <li key={i} className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold">
                  {i + 1}
                </div>
                <span className="text-sm text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => router.push(dashboardHref)}
          className="mt-8 w-full sm:w-auto px-8 py-3 bg-[#1a1a1a] text-white rounded font-medium hover:bg-gray-800 inline-flex items-center justify-center gap-2"
        >
          Go to {accountType === 'solo' ? 'my dashboard' : 'dispatcher dashboard'}
          <ArrowRight size={16} />
        </button>
      </div>
    </SignupShell>
  )
}
