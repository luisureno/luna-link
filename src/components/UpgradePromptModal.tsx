'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { X, ArrowRight, Check, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { nextPlanUp, PLAN_LIMITS, formatPrice, type LimitResource } from '@/lib/plan-limits'
import type { PlanId, Plan } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  currentPlan: PlanId
  resource?: LimitResource | 'feature'
  currentCount?: number
  billingHref: string
  /** Custom heading override */
  title?: string
  /** Custom body override */
  body?: string
}

const RESOURCE_LABEL: Record<LimitResource, string> = {
  drivers: 'driver',
  trucks: 'truck',
}

export function UpgradePromptModal({
  open,
  onClose,
  currentPlan,
  resource,
  currentCount,
  billingHref,
  title,
  body,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [targetPlan, setTargetPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)

  const nextId = useMemo(() => nextPlanUp(currentPlan), [currentPlan])

  useEffect(() => {
    if (!open) return
    if (!nextId) {
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('plans')
      .select('*')
      .eq('id', nextId)
      .single()
      .then(({ data }) => {
        setTargetPlan((data as Plan) ?? null)
        setLoading(false)
      })
  }, [open, nextId, supabase])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const currentLimit = resource && resource !== 'feature' ? PLAN_LIMITS[currentPlan][resource] : null
  const nextLimit = resource && resource !== 'feature' && nextId ? PLAN_LIMITS[nextId][resource] : null

  const heading =
    title ??
    (resource && resource !== 'feature'
      ? `You've reached your ${RESOURCE_LABEL[resource]} limit`
      : 'Upgrade to unlock this')

  const subheading =
    body ??
    (resource && resource !== 'feature' && currentLimit != null
      ? `Your ${currentPlan} plan supports up to ${currentLimit} ${RESOURCE_LABEL[resource]}${
          currentLimit === 1 ? '' : 's'
        }${currentCount != null ? ` — you're at ${currentCount}` : ''}.`
      : 'This feature is available on a higher plan.')

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 md:p-6 border-b border-gray-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900">{heading}</h3>
              <p className="text-xs text-gray-600 mt-1">{subheading}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 -m-1 text-gray-400 hover:text-gray-900 flex-shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 md:p-6">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-6">Loading…</p>
          ) : !nextId || !targetPlan ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-700">
                You're already on our top self-serve plan. Contact sales for Enterprise.
              </p>
              <Link
                href="/#pricing"
                className="mt-3 inline-block px-4 py-2 bg-[#1a1a1a] text-white rounded text-sm font-medium hover:bg-gray-800"
              >
                Contact sales
              </Link>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Upgrade to</p>
                    <p className="text-lg font-semibold text-gray-900">{targetPlan.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-gray-900">{formatPrice(targetPlan.price_monthly)}</p>
                    <p className="text-[10px] text-gray-500">/ month</p>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {resource && resource !== 'feature' && nextLimit != null && (
                    <li className="flex gap-2 items-start text-sm text-gray-700">
                      <Check size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        Up to <strong>{nextLimit}</strong> {RESOURCE_LABEL[resource]}
                        {nextLimit === 1 ? '' : 's'}
                      </span>
                    </li>
                  )}
                  {(targetPlan.features ?? []).slice(0, 4).map((f, i) => (
                    <li key={i} className="flex gap-2 items-start text-sm text-gray-700">
                      <Check size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 space-y-2">
                <Link
                  href={`${billingHref}?upgrade=${nextId}`}
                  onClick={onClose}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#1a1a1a] text-white rounded font-medium hover:bg-gray-800"
                >
                  Upgrade to {targetPlan.name}
                  <ArrowRight size={14} />
                </Link>
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Maybe later
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Also export a lightweight hook for simple open/close state
export function useUpgradePrompt() {
  const [open, setOpen] = useState(false)
  const [context, setContext] = useState<{ resource?: LimitResource | 'feature'; currentCount?: number; title?: string; body?: string }>({})
  return {
    open,
    context,
    show: (ctx: typeof context) => {
      setContext(ctx)
      setOpen(true)
    },
    close: () => setOpen(false),
  }
}
