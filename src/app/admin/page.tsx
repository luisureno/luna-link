'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, ExternalLink, X } from 'lucide-react'

interface CompanyRequest {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string | null
  fleet_size: string | null
  notes: string | null
  status: string
  created_at: string
}

interface OnboardResult {
  owner_email: string
  temp_password: string
  invite_token: string
}

export default function AdminPage() {
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')

  useEffect(() => {
    fetch('/api/admin/check')
      .then(r => r.json())
      .then(d => {
        setAuthed(d.authed)
        setChecking(false)
      })
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      setAuthed(true)
    } else {
      setPwError('Invalid password')
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F5]">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F5] p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Admin</h1>
          </div>
          <form onSubmit={handleLogin} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            {pwError && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{pwError}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                required
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <button type="submit" className="w-full py-2.5 bg-[#1a1a1a] text-white text-sm font-medium rounded hover:bg-gray-800">
              Unlock
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <AdminDashboard />
}

function AdminDashboard() {
  const [requests, setRequests] = useState<CompanyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [prefill, setPrefill] = useState<CompanyRequest | null>(null)
  const [onboardResult, setOnboardResult] = useState<OnboardResult | null>(null)

  async function loadRequests() {
    setLoading(true)
    const res = await fetch('/api/admin/requests')
    const data = await res.json()
    setRequests(data.requests ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const pending = requests.filter(r => r.status === 'new')
  const done = requests.filter(r => r.status !== 'new')

  return (
    <div className="min-h-screen bg-[#F8F7F5] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Admin</h1>
            <p className="text-sm text-gray-500">Onboard new companies and review access requests.</p>
          </div>
        </div>

        {onboardResult && <OnboardSuccessCard result={onboardResult} onClose={() => setOnboardResult(null)} />}

        {/* Pending requests */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Incoming requests {pending.length > 0 && <span className="ml-1 text-gray-500 font-normal">({pending.length})</span>}
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-6 text-sm text-gray-500">Loading…</div>
            ) : pending.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">No pending requests.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pending.map(r => (
                  <div key={r.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{r.company_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.contact_name} · {r.email}
                        {r.phone && ` · ${r.phone}`}
                        {r.fleet_size && ` · ${r.fleet_size}`}
                      </p>
                      {r.notes && <p className="text-xs text-gray-600 mt-1.5 whitespace-pre-wrap">{r.notes}</p>}
                      <p className="text-xs text-gray-400 mt-1.5">{new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => setPrefill(r)}
                      className="px-3 py-1.5 bg-[#1a1a1a] text-white text-xs rounded hover:bg-gray-800 whitespace-nowrap"
                    >
                      Onboard
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Onboard form */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">New company</h2>
          <OnboardForm
            prefill={prefill}
            onClearPrefill={() => setPrefill(null)}
            onSuccess={result => {
              setOnboardResult(result)
              setPrefill(null)
              loadRequests()
            }}
          />
        </section>

        {/* Archive */}
        {done.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Archive</h2>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="divide-y divide-gray-100">
                {done.map(r => (
                  <div key={r.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-900">{r.company_name}</p>
                      <p className="text-xs text-gray-500">{r.contact_name} · {r.email}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function OnboardForm({
  prefill,
  onClearPrefill,
  onSuccess,
}: {
  prefill: CompanyRequest | null
  onClearPrefill: () => void
  onSuccess: (r: OnboardResult) => void
}) {
  const [companyName, setCompanyName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [ownerFullName, setOwnerFullName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (prefill) {
      setCompanyName(prefill.company_name)
      setCompanyPhone(prefill.phone ?? '')
      setOwnerFullName(prefill.contact_name)
      setOwnerEmail(prefill.email)
      setOwnerPhone(prefill.phone ?? '')
    }
  }, [prefill])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const res = await fetch('/api/admin/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: companyName,
        company_address: companyAddress,
        company_phone: companyPhone,
        owner_full_name: ownerFullName,
        owner_email: ownerEmail,
        owner_phone: ownerPhone,
        request_id: prefill?.id,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed')
      setSubmitting(false)
      return
    }

    setCompanyName('')
    setCompanyAddress('')
    setCompanyPhone('')
    setOwnerFullName('')
    setOwnerEmail('')
    setOwnerPhone('')
    setSubmitting(false)
    onSuccess(data)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      {prefill && (
        <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-xs text-blue-800 flex items-center justify-between">
          <span>Prefilled from request: <strong>{prefill.company_name}</strong></span>
          <button type="button" onClick={onClearPrefill} className="text-blue-700 hover:text-blue-900">
            <X size={14} />
          </button>
        </div>
      )}

      {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</p>
          <input required placeholder="Company name" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <input placeholder="Address" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <input placeholder="Phone" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Owner</p>
          <input required placeholder="Full name" value={ownerFullName} onChange={e => setOwnerFullName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <input required type="email" placeholder="Email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <input placeholder="Phone" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
      </div>

      <button type="submit" disabled={submitting} className="w-full md:w-auto px-5 py-2.5 bg-[#1a1a1a] text-white text-sm font-medium rounded hover:bg-gray-800 disabled:opacity-50">
        {submitting ? 'Creating…' : 'Create Company + Owner Account'}
      </button>
    </form>
  )
}

function OnboardSuccessCard({ result, onClose }: { result: OnboardResult; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${result.invite_token}` : ''

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(label)
    setTimeout(() => setCopied(null), 1800)
  }

  return (
    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-5 mb-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-green-900">✓ Company created</h3>
          <p className="text-xs text-green-700 mt-0.5">Send these to the owner. They can change the password after logging in.</p>
        </div>
        <button onClick={onClose} className="text-green-700 hover:text-green-900">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2">
        <CredRow label="Login URL" value={typeof window !== 'undefined' ? `${window.location.origin}/login` : ''} copied={copied === 'url'} onCopy={v => copy('url', v)} external />
        <CredRow label="Email" value={result.owner_email} copied={copied === 'email'} onCopy={v => copy('email', v)} />
        <CredRow label="Temp password" value={result.temp_password} copied={copied === 'pw'} onCopy={v => copy('pw', v)} mono />
        <CredRow label="Driver invite link" value={inviteUrl} copied={copied === 'invite'} onCopy={v => copy('invite', v)} />
      </div>
    </div>
  )
}

function CredRow({ label, value, copied, onCopy, mono, external }: { label: string; value: string; copied: boolean; onCopy: (v: string) => void; mono?: boolean; external?: boolean }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-green-200 rounded px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={`text-sm text-gray-900 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
      {external && (
        <a href={value} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-gray-900">
          <ExternalLink size={14} />
        </a>
      )}
      <button onClick={() => onCopy(value)} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1">
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
