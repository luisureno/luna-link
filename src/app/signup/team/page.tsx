'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, Check, Users, Share2 } from 'lucide-react'
import { SignupShell, StepIndicator } from '@/components/signup/SignupShell'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'

export default function TeamStep() {
  const router = useRouter()
  const supabase = createClient()
  const { profile, loading: authLoading } = useAuth()

  const [inviteLink, setInviteLink] = useState('')
  const [planId, setPlanId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!profile) {
      router.replace('/login')
      return
    }

    async function load() {
      const { data: company } = await supabase
        .from('companies')
        .select('invite_token, plan_id')
        .eq('id', profile!.company_id)
        .single()

      if (!company) {
        setLoading(false)
        return
      }

      setPlanId(company.plan_id)
      if (company.plan_id === 'solo') {
        router.replace('/signup/clients')
        return
      }

      setInviteLink(`${window.location.origin}/join/${company.invite_token}`)
      setLoading(false)
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, profile?.company_id])

  async function handleCopy() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleShare() {
    if (!inviteLink) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join our fleet on HaulProof',
          text: 'Register to start running loads:',
          url: inviteLink,
        })
      } catch {
        // User cancelled share sheet
      }
    } else {
      handleCopy()
    }
  }

  if (loading || planId === 'solo') {
    return (
      <SignupShell>
        <div className="text-center text-sm text-gray-500">Loading…</div>
      </SignupShell>
    )
  }

  return (
    <SignupShell>
      <StepIndicator current={4} />
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">Invite your drivers</h1>
        <p className="mt-2 text-sm text-gray-600">Share one link. Each driver registers on their phone and they're ready to run loads.</p>
      </div>

      <div className="max-w-xl mx-auto space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <Users size={16} className="text-gray-700" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Your driver invite link</h2>
          </div>

          <div className="flex items-stretch gap-2">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 min-w-0 px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 bg-gray-50 font-mono truncate"
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2.5 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 flex-shrink-0"
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="px-3 py-2.5 bg-[#1a1a1a] text-white rounded text-sm font-medium hover:bg-gray-800 flex items-center gap-1.5 flex-shrink-0"
            >
              <Share2 size={14} />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Text this link to each driver. They'll register with their name, phone, and truck number — then they're in.
          </p>
        </div>

        <div className="bg-[#F8F7F5] border border-gray-200 rounded-xl p-5 text-sm text-gray-700">
          <strong className="text-gray-900">Don't have drivers ready yet?</strong> You can always invite them later from{' '}
          <span className="font-medium">Settings → Users</span>.
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/signup/clients')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Skip for now
          </button>
          <Link
            href="/signup/clients"
            className="w-full sm:w-auto px-6 py-3 bg-[#1a1a1a] text-white rounded font-medium hover:bg-gray-800 text-center"
          >
            Continue
          </Link>
        </div>
      </div>
    </SignupShell>
  )
}
