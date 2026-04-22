'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, Sparkles, CreditCard, AlertTriangle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePlan } from '@/lib/usePlan'
import { formatPrice, PLAN_LIMITS } from '@/lib/plan-limits'
import type { Plan, PlanId, BillingCycle } from '@/types'

interface Props {
  backHref: string
}

export function BillingPanel({ backHref }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const search = useSearchParams()
  const { loading: planLoading, plan, company, subscription, daysLeft, refresh } = usePlan()

  const [allPlans, setAllPlans] = useState<Plan[]>([])
  const [selected, setSelected] = useState<PlanId | null>(null)
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    supabase
      .from('plans')
      .select('*')
      .order('sort_order')
      .then(({ data }) => setAllPlans((data as Plan[]) ?? []))
  }, [supabase])

  useEffect(() => {
    if (plan?.id) setSelected(plan.id)
    if (subscription?.billing_cycle) setCycle(subscription.billing_cycle)
  }, [plan?.id, subscription?.billing_cycle])

  useEffect(() => {
    const upgradeParam = search.get('upgrade') as PlanId | null
    if (upgradeParam && (['solo', 'starter', 'fleet'] as PlanId[]).includes(upgradeParam)) {
      setSelected(upgradeParam)
    }
  }, [search])

  function flash(msg: string) {
    setStatusMsg(msg)
    setErrorMsg('')
    setTimeout(() => setStatusMsg(''), 2500)
  }

  async function changePlan() {
    if (!selected || !plan || !company) return
    setSaving(true)
    setErrorMsg('')

    const res = await fetch('/api/billing/change-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: selected, billing_cycle: cycle }),
    })
    const data = await res.json()

    if (!res.ok) {
      setErrorMsg(data.error ?? 'Failed to change plan')
    } else {
      flash(data.changed ? 'Plan updated' : 'No changes — already on this plan')
      await refresh()
    }
    setSaving(false)
  }

  async function activateBilling() {
    setSaving(true)
    setErrorMsg('')
    const res = await fetch('/api/billing/activate', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setErrorMsg(data.error ?? 'Failed to activate')
    } else {
      flash('Billing activated — trial ended')
      await refresh()
    }
    setSaving(false)
  }

  async function cancelSubscription() {
    if (!confirm('Cancel your subscription? You will lose access at the end of the current period.')) return
    setSaving(true)
    const res = await fetch('/api/billing/cancel', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setErrorMsg(data.error ?? 'Failed to cancel')
    } else {
      flash('Subscription canceled')
      await refresh()
    }
    setSaving(false)
  }

  if (planLoading || !company) {
    return <div className="text-sm text-gray-500">Loading…</div>
  }

  const selectablePlans = allPlans.filter(p => !p.is_custom)
  const onTrial = company.billing_status === 'trialing'
  const isActive = company.billing_status === 'active'
  const isCanceled = company.billing_status === 'canceled'
  const selectedPlan = allPlans.find(p => p.id === selected) ?? null
  const currentIsSelected = selected === plan?.id

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={backHref} className="text-xs font-medium text-gray-600 hover:text-gray-900">
          ← Back to settings
        </Link>
        {statusMsg && (
          <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
            {statusMsg}
          </span>
        )}
        {errorMsg && (
          <span className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
            {errorMsg}
          </span>
        )}
      </div>

      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Billing & plan</h1>
        <p className="text-sm text-gray-600 mt-1">Manage your subscription and payment.</p>
      </div>

      {/* Current plan summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Current plan</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{plan?.name ?? '—'}</p>
            {plan && (
              <p className="text-xs text-gray-500 mt-1">
                {formatPrice(plan.price_monthly)}/mo · Billed {subscription?.billing_cycle ?? 'monthly'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onTrial && daysLeft !== null && daysLeft > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1a1a1a] text-white px-2.5 py-1 text-xs font-medium">
                <Sparkles size={11} /> {daysLeft} day{daysLeft === 1 ? '' : 's'} left in trial
              </span>
            )}
            {onTrial && daysLeft !== null && daysLeft <= 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 text-red-800 px-2.5 py-1 text-xs font-medium">
                <AlertTriangle size={11} /> Trial ended
              </span>
            )}
            {isActive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 text-green-800 px-2.5 py-1 text-xs font-medium">
                <Check size={11} /> Active
              </span>
            )}
            {isCanceled && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-700 px-2.5 py-1 text-xs font-medium">
                Canceled
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-gray-700" />
              <h2 className="text-sm font-semibold text-gray-900">Payment method</h2>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Self-serve card billing is rolling out soon. For now, we'll activate your plan manually after a quick call — no card charged until you confirm.
            </p>
          </div>
          {!isActive && (
            <button
              onClick={activateBilling}
              disabled={saving}
              className="flex-shrink-0 px-4 py-2 bg-[#1a1a1a] text-white rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Activating…' : 'Activate now'}
            </button>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          Questions? Email <a href="mailto:billing@fleetwise.com" className="text-gray-700 underline">billing@fleetwise.com</a>.
        </p>
      </div>

      {/* Change plan */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6">
        <h2 className="text-sm font-semibold text-gray-900">Change plan</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">Pick a plan that fits your fleet.</p>

        <div className="inline-flex bg-gray-100 rounded-lg p-1 mb-4">
          <button
            onClick={() => setCycle('monthly')}
            className={`px-3 py-1 text-xs font-medium rounded-md ${
              cycle === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setCycle('annual')}
            className={`px-3 py-1 text-xs font-medium rounded-md ${
              cycle === 'annual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            Annual <span className="text-[9px] text-green-700 font-semibold">–2 mo</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {selectablePlans.map(p => {
            const isSelected = selected === p.id
            const isCurrent = plan?.id === p.id
            const price = cycle === 'monthly' ? p.price_monthly : Math.round((p.price_annual ?? p.price_monthly * 12) / 12)
            const limits = PLAN_LIMITS[p.id]
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={`text-left rounded-lg border-2 p-4 flex flex-col transition ${
                  isSelected ? 'border-[#1a1a1a]' : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  {isCurrent && (
                    <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-semibold text-gray-900">{formatPrice(price)}</span>
                  <span className="text-[11px] text-gray-500">/ mo</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {limits.drivers === null
                    ? 'Unlimited drivers'
                    : `${limits.drivers} driver${limits.drivers === 1 ? '' : 's'}`}
                </p>
              </button>
            )
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {selectedPlan && selectedPlan.id !== plan?.id
              ? `Switch to ${selectedPlan.name} — ${formatPrice(
                  cycle === 'monthly' ? selectedPlan.price_monthly : Math.round((selectedPlan.price_annual ?? selectedPlan.price_monthly * 12) / 12)
                )}/mo`
              : 'Pick a different plan to enable switching.'}
          </p>
          <button
            onClick={changePlan}
            disabled={saving || !selected || (currentIsSelected && cycle === subscription?.billing_cycle)}
            className="px-4 py-2 bg-[#1a1a1a] text-white rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving ? 'Saving…' : 'Save changes'}
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Danger zone */}
      {!isCanceled && (
        <div className="bg-white border border-red-200 rounded-xl p-5 md:p-6">
          <h2 className="text-sm font-semibold text-red-700">Cancel subscription</h2>
          <p className="text-xs text-gray-600 mt-1">
            Cancelling stops billing at the end of your current period. You'll keep access until then, then lose it.
          </p>
          <button
            onClick={cancelSubscription}
            disabled={saving}
            className="mt-3 px-4 py-2 border border-red-300 text-red-700 bg-white rounded text-sm font-medium hover:bg-red-50 disabled:opacity-50"
          >
            Cancel subscription
          </button>
        </div>
      )}
    </div>
  )
}
