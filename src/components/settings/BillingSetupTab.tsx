'use client'

import { useEffect, useMemo , useState } from 'react'
import { Plus, ChevronDown, ChevronUp, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import type { Client, User } from '@/types'

type BillingType = 'per_load' | 'hourly' | 'per_ton'
type DriverPayType = 'per_load' | 'per_ton' | 'hourly'

interface BillingConfig {
  id: string
  client_id: string
  job_type_name: string
  billing_type: BillingType
  client_rate_amount: number
  client_rate_unit: string
  driver_hours_per_load: number | null
  driver_pay_type: DriverPayType
  notes: string | null
  is_active: boolean
}

interface DriverPayRate {
  id: string
  driver_id: string
  hourly_rate: number | null
  per_load_rate: number | null
  per_ton_rate: number | null
  effective_date: string
  notes: string | null
}

function rateUnitForBillingType(bt: BillingType): string {
  if (bt === 'per_load') return 'per_load'
  if (bt === 'per_ton') return 'per_ton'
  return 'per_hour'
}

export function BillingSetupTab() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const [subTab, setSubTab] = useState<'client' | 'driver'>('client')
  const [clients, setClients] = useState<Client[]>([])
  const [configs, setConfigs] = useState<BillingConfig[]>([])
  const [drivers, setDrivers] = useState<User[]>([])
  const [payRates, setPayRates] = useState<DriverPayRate[]>([])
  const [loading, setLoading] = useState(true)

  // Client billing config form state
  const [addingForClient, setAddingForClient] = useState<string | null>(null)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    job_type_name: '',
    billing_type: 'per_load' as BillingType,
    client_rate_amount: '',
    driver_hours_per_load: '',
    driver_pay_type: 'per_load' as DriverPayType,
    notes: '',
  })

  // Driver pay rate form state
  const [editingDriver, setEditingDriver] = useState<string | null>(null)
  const [payForm, setPayForm] = useState({
    hourly_rate: '',
    per_load_rate: '',
    per_ton_rate: '',
    effective_date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [savingPay, setSavingPay] = useState(false)

  useEffect(() => {
    if (!profile?.company_id) return
    loadAll()
  }, [profile?.company_id])

  async function loadAll() {
    const cid = profile!.company_id
    setLoading(true)
    const [clientsRes, configsRes, driversRes, ratesRes] = await Promise.all([
      supabase.from('clients').select('*').eq('company_id', cid).order('name'),
      supabase.from('client_billing_configs').select('*').eq('company_id', cid).order('created_at'),
      supabase.from('users').select('*').eq('company_id', cid).eq('role', 'driver').order('full_name'),
      supabase.from('driver_pay_rates').select('*').eq('company_id', cid).order('effective_date', { ascending: false }),
    ])
    setClients(clientsRes.data ?? [])
    setConfigs((configsRes.data ?? []) as BillingConfig[])
    setDrivers(driversRes.data ?? [])
    setPayRates((ratesRes.data ?? []) as DriverPayRate[])
    setLoading(false)
  }

  function resetForm() {
    setForm({ job_type_name: '', billing_type: 'per_load', client_rate_amount: '', driver_hours_per_load: '', driver_pay_type: 'per_load', notes: '' })
  }

  async function saveBillingConfig(clientId: string) {
    if (!form.job_type_name.trim() || !form.client_rate_amount) return
    setSaving(true)
    const bt = form.billing_type
    await supabase.from('client_billing_configs').insert({
      company_id: profile!.company_id,
      client_id: clientId,
      job_type_name: form.job_type_name.trim(),
      billing_type: bt,
      client_rate_amount: parseFloat(form.client_rate_amount),
      client_rate_unit: rateUnitForBillingType(bt),
      driver_hours_per_load: bt === 'per_load' && form.driver_hours_per_load ? parseFloat(form.driver_hours_per_load) : null,
      driver_pay_type: form.driver_pay_type,
      notes: form.notes.trim() || null,
    })
    resetForm()
    setAddingForClient(null)
    await loadAll()
    setSaving(false)
  }

  async function toggleConfigActive(id: string, current: boolean) {
    await supabase.from('client_billing_configs').update({ is_active: !current }).eq('id', id)
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c))
  }

  function startEditDriver(driver: User) {
    setEditingDriver(driver.id)
    const latest = payRates.find(r => r.driver_id === driver.id)
    setPayForm({
      hourly_rate: latest?.hourly_rate != null ? String(latest.hourly_rate) : '',
      per_load_rate: latest?.per_load_rate != null ? String(latest.per_load_rate) : '',
      per_ton_rate: latest?.per_ton_rate != null ? String(latest.per_ton_rate) : '',
      effective_date: new Date().toISOString().split('T')[0],
      notes: '',
    })
  }

  async function saveDriverPay(driverId: string) {
    setSavingPay(true)
    await supabase.from('driver_pay_rates').insert({
      company_id: profile!.company_id,
      driver_id: driverId,
      hourly_rate: payForm.hourly_rate ? parseFloat(payForm.hourly_rate) : null,
      per_load_rate: payForm.per_load_rate ? parseFloat(payForm.per_load_rate) : null,
      per_ton_rate: payForm.per_ton_rate ? parseFloat(payForm.per_ton_rate) : null,
      effective_date: payForm.effective_date,
      notes: payForm.notes.trim() || null,
    })
    setEditingDriver(null)
    await loadAll()
    setSavingPay(false)
  }

  const latestRate = (driverId: string) => payRates.find(r => r.driver_id === driverId)

  if (loading) return <div className="py-8 text-center text-sm text-gray-500">Loading billing setup…</div>

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Billing Setup</h2>
        <p className="text-sm text-gray-500 mt-1">Configure how you charge each client and pay your drivers. Set this up once — the app calculates everything automatically.</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['client', 'driver'] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${subTab === t ? 'border-[#1a1a1a] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'client' ? 'Client Billing Rates' : 'Driver Pay Rates'}
          </button>
        ))}
      </div>

      {/* ── CLIENT BILLING RATES ── */}
      {subTab === 'client' && (
        <div className="space-y-3">
          {clients.length === 0 && (
            <p className="text-sm text-gray-500">No clients yet. Add clients first in the Clients page.</p>
          )}
          {clients.map(client => {
            const clientConfigs = configs.filter(c => c.client_id === client.id)
            const isExpanded = expandedClient === client.id
            const isAdding = addingForClient === client.id

            return (
              <div key={client.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Client header row */}
                <button
                  onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{client.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{clientConfigs.length === 0 ? 'No billing configs yet' : `${clientConfigs.length} config${clientConfigs.length > 1 ? 's' : ''}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); setAddingForClient(isAdding ? null : client.id); setExpandedClient(client.id); resetForm() }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1a1a1a] text-white text-xs rounded hover:bg-gray-800"
                    >
                      <Plus size={12} /> Add Config
                    </button>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Existing configs */}
                {isExpanded && clientConfigs.length > 0 && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {clientConfigs.map(cfg => (
                      <div key={cfg.id} className={`px-4 py-3 ${!cfg.is_active ? 'opacity-50' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">{cfg.job_type_name}</p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              Client: <strong>${Number(cfg.client_rate_amount).toFixed(4)}</strong> {cfg.client_rate_unit.replace('_', ' ')}
                              {cfg.billing_type === 'per_load' && cfg.driver_hours_per_load && (
                                <> · Driver: <strong>{cfg.driver_hours_per_load} hrs/load</strong></>
                              )}
                            </p>
                            <span className={`inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.billing_type === 'per_load' ? 'bg-blue-50 text-blue-700' : cfg.billing_type === 'hourly' ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700'}`}>
                              {cfg.billing_type.replace('_', ' ')}
                            </span>
                            {cfg.notes && <p className="text-xs text-gray-400 mt-1">{cfg.notes}</p>}
                          </div>
                          <button
                            onClick={() => toggleConfigActive(cfg.id, cfg.is_active)}
                            className="text-xs text-gray-400 hover:text-gray-700 whitespace-nowrap flex-shrink-0"
                          >
                            {cfg.is_active ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add billing config form */}
                {isAdding && (
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-gray-900">New Billing Config</p>
                      <button onClick={() => setAddingForClient(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Job Type Name <span className="text-red-500">*</span></label>
                        <input
                          value={form.job_type_name}
                          onChange={e => setForm(f => ({ ...f, job_type_name: e.target.value }))}
                          placeholder="e.g. Concrete Sand Quarry Runs"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Billing Type <span className="text-red-500">*</span></label>
                        <div className="flex gap-2 flex-wrap">
                          {(['per_load', 'hourly', 'per_ton'] as BillingType[]).map(bt => (
                            <label key={bt} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name="billing_type" checked={form.billing_type === bt} onChange={() => setForm(f => ({ ...f, billing_type: bt, driver_pay_type: bt === 'per_load' ? 'per_load' : bt === 'per_ton' ? 'per_ton' : 'hourly' }))} />
                              <span className="text-sm text-gray-700 capitalize">{bt.replace('_', ' ')}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Client rate <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">$</span>
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            value={form.client_rate_amount}
                            onChange={e => setForm(f => ({ ...f, client_rate_amount: e.target.value }))}
                            placeholder="0.00"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                          <span className="text-sm text-gray-500 whitespace-nowrap">{rateUnitForBillingType(form.billing_type).replace('_', ' ')}</span>
                        </div>
                      </div>

                      {form.billing_type === 'per_load' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Driver hours per load</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={form.driver_hours_per_load}
                              onChange={e => setForm(f => ({ ...f, driver_hours_per_load: e.target.value }))}
                              placeholder="e.g. 3"
                              className="w-32 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                            />
                            <span className="text-sm text-gray-500">hours × driver hourly rate = driver pay per load</span>
                          </div>
                        </div>
                      )}

                      {form.billing_type === 'per_ton' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Driver pay type</label>
                          <div className="flex gap-3">
                            {(['per_ton', 'hourly'] as DriverPayType[]).map(pt => (
                              <label key={pt} className="flex items-center gap-1.5 cursor-pointer">
                                <input type="radio" name="driver_pay_type" checked={form.driver_pay_type === pt} onChange={() => setForm(f => ({ ...f, driver_pay_type: pt }))} />
                                <span className="text-sm text-gray-700 capitalize">{pt.replace('_', ' ')}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                        <input
                          value={form.notes}
                          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="Any notes about this billing config"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => setAddingForClient(null)} className="px-3 py-2 border border-gray-300 rounded text-sm">Cancel</button>
                        <button
                          onClick={() => saveBillingConfig(client.id)}
                          disabled={saving || !form.job_type_name.trim() || !form.client_rate_amount}
                          className="px-4 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800 disabled:opacity-50"
                        >
                          {saving ? 'Saving…' : 'Save Billing Config'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── DRIVER PAY RATES ── */}
      {subTab === 'driver' && (
        <div className="space-y-3">
          {drivers.length === 0 && (
            <p className="text-sm text-gray-500">No drivers yet. Add drivers in Settings → Users.</p>
          )}
          {drivers.map(driver => {
            const latest = latestRate(driver.id)
            const isEditing = editingDriver === driver.id

            return (
              <div key={driver.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{driver.full_name}</p>
                    {driver.truck_number && <p className="text-xs text-gray-500">{driver.truck_number}</p>}
                    {latest ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        {latest.hourly_rate != null && <p className="text-xs text-gray-600">${Number(latest.hourly_rate).toFixed(2)}/hr</p>}
                        {latest.per_load_rate != null && <p className="text-xs text-gray-600">${Number(latest.per_load_rate).toFixed(2)}/load</p>}
                        {latest.per_ton_rate != null && <p className="text-xs text-gray-600">${Number(latest.per_ton_rate).toFixed(2)}/ton</p>}
                        <p className="text-xs text-gray-400">effective {latest.effective_date}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">No pay rate set</p>
                    )}
                  </div>
                  <button
                    onClick={() => isEditing ? setEditingDriver(null) : startEditDriver(driver)}
                    className="text-xs text-gray-500 hover:text-gray-900 underline flex-shrink-0"
                  >
                    {isEditing ? 'Cancel' : latest ? 'Update' : 'Set Rate'}
                  </button>
                </div>

                {isEditing && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-3">
                    <p className="text-xs font-medium text-gray-700">Enter any rates that apply to this driver:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Hourly rate</label>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500">$</span>
                          <input type="number" step="0.01" min="0" value={payForm.hourly_rate} onChange={e => setPayForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="0.00" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          <span className="text-xs text-gray-400">/hr</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Per load rate</label>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500">$</span>
                          <input type="number" step="0.01" min="0" value={payForm.per_load_rate} onChange={e => setPayForm(f => ({ ...f, per_load_rate: e.target.value }))} placeholder="0.00" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          <span className="text-xs text-gray-400">/load</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Per ton rate</label>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500">$</span>
                          <input type="number" step="0.01" min="0" value={payForm.per_ton_rate} onChange={e => setPayForm(f => ({ ...f, per_ton_rate: e.target.value }))} placeholder="0.00" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          <span className="text-xs text-gray-400">/ton</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Effective date</label>
                        <input type="date" value={payForm.effective_date} onChange={e => setPayForm(f => ({ ...f, effective_date: e.target.value }))} className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Notes</label>
                        <input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                      </div>
                    </div>
                    <button
                      onClick={() => saveDriverPay(driver.id)}
                      disabled={savingPay}
                      className="px-4 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800 disabled:opacity-50"
                    >
                      {savingPay ? 'Saving…' : 'Save Pay Rate'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
