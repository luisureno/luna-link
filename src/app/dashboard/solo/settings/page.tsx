'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { User, DollarSign, Building2, Sparkles, ArrowUpRight, Check, Copy, Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { daysLeftInTrial } from '@/lib/plan-limits'
import type { Company, Plan } from '@/types'
import { AppLoader } from '@/components/AppLoader'

export default function SoloSettingsPage() {
  const { profile, signOut } = useAuth()
  const { lang, setLang } = useLanguage()
  const supabase = useMemo(() => createClient(), [])

  const [company, setCompany] = useState<Company | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPay, setSavingPay] = useState(false)
  const [savingCompany, setSavingCompany] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [copied, setCopied] = useState(false)

  // Profile fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [truckNumber, setTruckNumber] = useState('')

  // Pay fields
  const [payType, setPayType] = useState<'per_load' | 'hourly' | ''>('')
  const [payRate, setPayRate] = useState('')

  // Company fields
  const [companyName, setCompanyName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')

  useEffect(() => {
    if (!profile) return

    async function load() {
      try {
        const [{ data: companyRow }] = await Promise.all([
          supabase.from('companies').select('*').eq('id', profile!.company_id).single(),
        ])
        setCompany((companyRow as Company) ?? null)
        if (companyRow?.plan_id) {
          const { data: planRow } = await supabase
            .from('plans')
            .select('*')
            .eq('id', companyRow.plan_id)
            .single()
          setPlan((planRow as Plan) ?? null)
        }

        setFullName(profile!.full_name ?? '')
        setPhone(profile!.phone ?? '')
        setTruckNumber(profile!.truck_number ?? '')
        setPayType(profile!.pay_type ?? '')
        setPayRate(profile!.pay_rate != null ? String(profile!.pay_rate) : '')

        if (companyRow) {
          setCompanyName(companyRow.name ?? '')
          setCompanyAddress(companyRow.address ?? '')
          setCompanyPhone(companyRow.phone ?? '')
          setLogoUrl(companyRow.logo_url ?? null)
        }
      } finally {
        setLoading(false)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  function flash(msg: string) {
    setStatusMsg(msg)
    setTimeout(() => setStatusMsg(''), 2500)
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    await supabase
      .from('users')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        truck_number: truckNumber.trim() || null,
      })
      .eq('id', profile!.id)
    setSavingProfile(false)
    flash('Profile saved')
  }

  async function savePay(e: React.FormEvent) {
    e.preventDefault()
    setSavingPay(true)
    const rate = payRate ? Number(payRate) : null
    await supabase
      .from('users')
      .update({
        pay_type: payType || null,
        pay_rate: rate,
      })
      .eq('id', profile!.id)
    setSavingPay(false)
    flash('Pay rate saved')
  }

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault()
    setSavingCompany(true)
    await supabase
      .from('companies')
      .update({
        name: companyName.trim(),
        address: companyAddress.trim() || null,
        phone: companyPhone.trim() || null,
      })
      .eq('id', profile!.company_id)
    setSavingCompany(false)
    flash('Company info saved')
  }

  async function uploadLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) { flash('Logo must be under 2 MB.'); return }
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${profile!.company_id}/logo.${ext}`
      const { data } = await supabase.storage.from('company-logos').upload(path, file, { upsert: true, contentType: file.type })
      if (data) {
        const { data: { publicUrl } } = supabase.storage.from('company-logos').getPublicUrl(data.path)
        await supabase.from('companies').update({ logo_url: publicUrl }).eq('id', profile!.company_id)
        setLogoUrl(publicUrl)
        flash('Logo saved')
      }
    } finally {
      setUploadingLogo(false)
    }
  }

  async function removeLogo() {
    await supabase.from('companies').update({ logo_url: null }).eq('id', profile!.company_id)
    setLogoUrl(null)
    flash('Logo removed')
  }

  async function handleSignOut() {
    await signOut()
    window.location.href = '/login'
  }

  async function handleCopyInvite() {
    if (!company?.id) return
    const { data } = await supabase
      .from('companies')
      .select('invite_token')
      .eq('id', company.id)
      .single()
    if (data?.invite_token) {
      const link = `${window.location.origin}/join/${data.invite_token}`
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const daysLeft = daysLeftInTrial(company?.trial_ends_at ?? null)
  const onTrial = company?.billing_status === 'trialing'

  if (loading || !profile) return <AppLoader />

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        {statusMsg && (
          <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
            {statusMsg}
          </span>
        )}
      </div>

      {/* Plan / billing summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{plan?.name ?? '—'}</p>
            {onTrial && daysLeft !== null && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#1a1a1a] text-white px-2.5 py-1 text-xs font-medium">
                <Sparkles size={11} />
                {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in trial` : 'Trial ended'}
              </div>
            )}
            {!onTrial && company?.billing_status === 'active' && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-100 text-green-800 px-2.5 py-1 text-xs font-medium">
                <Check size={11} /> Active
              </div>
            )}
          </div>
          <Link
            href="/dashboard/solo/settings/billing"
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-900 hover:underline"
          >
            Billing
            <ArrowUpRight size={12} />
          </Link>
        </div>
        <p className="text-[11px] text-gray-500 mt-3">
          Need more trucks or a dispatcher? Upgrade to Starter or Fleet anytime.
        </p>
      </div>

      {/* Profile */}
      <form onSubmit={saveProfile} className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <User size={14} className="text-gray-700" />
          <h2 className="text-sm font-semibold text-gray-900">Your profile</h2>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Full name</label>
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Truck number</label>
            <input
              value={truckNumber}
              onChange={e => setTruckNumber(e.target.value)}
              placeholder="e.g. T-101"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>

        <div className="pt-1">
          <button
            type="submit"
            disabled={savingProfile}
            className="px-4 py-2 bg-[#1a1a1a] text-white rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>

      {/* Pay rate */}
      <form onSubmit={savePay} className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign size={14} className="text-gray-700" />
          <h2 className="text-sm font-semibold text-gray-900">How you pay yourself</h2>
        </div>
        <p className="text-[11px] text-gray-500">Sets how your live earnings are calculated on Today.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Pay type</label>
            <select
              value={payType}
              onChange={e => setPayType(e.target.value as 'per_load' | 'hourly' | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">Not set</option>
              <option value="per_load">Per load</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Rate {payType === 'per_load' ? '($/load)' : payType === 'hourly' ? '($/hr)' : ''}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={payRate}
              onChange={e => setPayRate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>

        <div className="pt-1">
          <button
            type="submit"
            disabled={savingPay}
            className="px-4 py-2 bg-[#1a1a1a] text-white rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {savingPay ? 'Saving…' : 'Save pay rate'}
          </button>
        </div>
      </form>

      {/* Company */}
      <form onSubmit={saveCompany} className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={14} className="text-gray-700" />
          <h2 className="text-sm font-semibold text-gray-900">Company info</h2>
        </div>
        <p className="text-[11px] text-gray-500">Shows up on your client invoices.</p>

        {/* Logo */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Business Logo</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl
                ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                : <span className="text-[10px] text-gray-400 text-center px-1">No logo</span>
              }
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className={`inline-block px-3 py-1.5 text-xs font-medium border border-gray-300 rounded cursor-pointer hover:bg-gray-50 ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadingLogo ? 'Uploading…' : logoUrl ? 'Replace' : 'Upload Logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }}
                    disabled={uploadingLogo}
                  />
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400">PNG, JPG, SVG · Max 2 MB · appears on invoices</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Company name</label>
          <input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
          <input
            value={companyAddress}
            onChange={e => setCompanyAddress(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Business phone</label>
          <input
            type="tel"
            value={companyPhone}
            onChange={e => setCompanyPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div className="pt-1">
          <button
            type="submit"
            disabled={savingCompany}
            className="px-4 py-2 bg-[#1a1a1a] text-white rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {savingCompany ? 'Saving…' : 'Save company info'}
          </button>
        </div>
      </form>

      {/* Hiring help */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <p className="text-sm font-semibold text-gray-900">Hiring help?</p>
        <p className="text-xs text-gray-500 mt-1">
          Adding a second driver requires upgrading to Starter.{' '}
          <Link href="/dashboard/solo/settings/billing" className="text-gray-900 font-medium underline">
            Upgrade plan
          </Link>{' '}
          first, then copy your driver invite link below to share.
        </p>
        <button
          onClick={handleCopyInvite}
          disabled={plan?.id === 'solo'}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy driver invite link'}
        </button>
      </div>

      {/* Language */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={16} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Language</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">Affects all views in the app for your session.</p>
        <div className="flex gap-2">
          <button
            onClick={() => setLang('en')}
            className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${lang === 'en' ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            English
          </button>
          <button
            onClick={() => setLang('es')}
            className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${lang === 'es' ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Español
          </button>
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full py-3 border border-gray-300 rounded text-sm font-medium text-red-600 bg-white hover:bg-red-50"
      >
        Sign out
      </button>
    </div>
  )
}
