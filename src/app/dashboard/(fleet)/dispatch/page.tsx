'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Dispatch, Client, User } from '@/types'
import { formatDate, mapsUrl } from '@/lib/format'
import { AppLoader } from '@/components/AppLoader'

const MATERIALS = [
  'Dirt', 'Fill Dirt', 'Gravel', 'Crushed Rock', 'Sand', 'Concrete Sand',
  'Asphalt', 'Base Material', 'Debris', 'Rip Rap', 'Other',
]

interface DispatchForm {
  client_id: string
  job_site_address: string
  scheduled_date: string
  scheduled_time: string
  hauling: string
  billing_type: 'per_load' | 'per_hour'
  hours_per_load: string
  po_number: string
  notes: string
}

export default function DispatchPage() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [showModal, setShowModal] = useState(false)
  const [dispatches, setDispatches] = useState<(Dispatch & { clients: Client })[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [drivers, setDrivers] = useState<User[]>([])
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([])
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('new')
  const [newClientName, setNewClientName] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<DispatchForm>({
    defaultValues: {
      scheduled_date: new Date().toISOString().split('T')[0],
      billing_type: 'per_load',
    }
  })

  const billingType = watch('billing_type')

  useEffect(() => {
    if (!profile?.company_id) return
    loadData()
  }, [profile?.company_id])

  async function loadData() {
    const cid = profile!.company_id
    const today = new Date().toISOString().split('T')[0]

    const [dispatchesRes, clientsRes, driversRes] = await Promise.all([
      supabase.from('dispatches').select('*, clients(*)').eq('company_id', cid).gte('scheduled_date', today).neq('status', 'cancelled').order('scheduled_date'),
      supabase.from('clients').select('*').eq('company_id', cid).order('name'),
      supabase.from('users').select('*').eq('company_id', cid).eq('role', 'driver').eq('is_active', true).order('full_name'),
    ])

    setDispatches((dispatchesRes.data ?? []) as any)
    setClients(clientsRes.data ?? [])
    setDrivers(driversRes.data ?? [])
    setLoading(false)
  }

  async function onSubmit(data: DispatchForm) {
    setFormError('')
    if (clientMode === 'new' && !newClientName.trim()) {
      setFormError('Enter a client name.')
      return
    }
    if (clientMode === 'existing' && !data.client_id) {
      setFormError('Select a client.')
      return
    }
    if (selectedDrivers.length === 0) {
      setFormError('Select at least one driver.')
      return
    }
    setSubmitting(true)

    let clientId: string | null = data.client_id || null
    let clientName: string | null = null

    if (clientMode === 'new') {
      clientName = newClientName.trim()
      clientId = null
    } else {
      clientName = clients.find(c => c.id === clientId)?.name ?? null
    }

    const autoTitle = [clientName ?? 'Job', data.hauling, formatDate(data.scheduled_date)].filter(Boolean).join(' · ')

    const { data: dispatch, error: dispatchError } = await supabase.from('dispatches').insert({
      company_id: profile!.company_id,
      dispatcher_id: profile!.id,
      title: autoTitle,
      client_id: clientId,
      client_name: clientMode === 'new' ? clientName : null,
      job_site_address: data.job_site_address || null,
      scheduled_date: data.scheduled_date,
      scheduled_time: data.scheduled_time || null,
      material_type: data.hauling || null,
      billing_type: data.billing_type || null,
      hours_per_load: data.billing_type === 'per_load' && data.hours_per_load ? parseFloat(data.hours_per_load) : null,
      po_number: data.po_number || null,
      notes: data.notes || null,
      status: 'pending',
    }).select().single()

    if (dispatchError || !dispatch) {
      setFormError(dispatchError?.message ?? 'Failed to send dispatch. Try again.')
      setSubmitting(false)
      return
    }

    await supabase.from('dispatch_assignments').insert(
      selectedDrivers.map(driver_id => ({ dispatch_id: dispatch.id, driver_id, status: 'assigned' }))
    )

    setShowModal(false)
    reset({ scheduled_date: new Date().toISOString().split('T')[0], billing_type: 'per_load' })
    setSelectedDrivers([])
    setClientMode('new')
    setNewClientName('')
    setFormError('')
    await loadData()
    setSubmitting(false)
  }

  async function cancelDispatch(id: string) {
    if (!confirm('Cancel this dispatch? The driver will no longer see it.')) return
    await supabase.from('dispatches').update({ status: 'cancelled' }).eq('id', id)
    await loadData()
  }

  if (loading) return <AppLoader />

  return (
    <div>
      <PageHeader
        title="Dispatch"
        subtitle="Send jobs to drivers"
        action={
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800">
            <Plus size={16} /> New Dispatch
          </button>
        }
      />

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {dispatches.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No dispatches yet. Create your first dispatch above.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {dispatches.map(d => (
                <div key={d.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{(d.clients as Client)?.name ?? d.client_name ?? '—'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {d.material_type && <span>{d.material_type} · </span>}
                        {d.job_site_address && (
                          <><a href={mapsUrl(d.job_site_address)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-800">{d.job_site_address}</a>{' · '}</>
                        )}
                        {formatDate(d.scheduled_date)}
                        {d.scheduled_time && ` · ${d.scheduled_time}`}
                      </p>
                      {d.billing_type && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {d.billing_type === 'per_load'
                            ? `Per load${d.hours_per_load ? ` · ${d.hours_per_load} hrs guaranteed` : ''}`
                            : 'Per hour'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={d.status} />
                      <button
                        onClick={() => cancelDispatch(d.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Cancel dispatch"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Hauling</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Address</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Billing</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dispatches.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{(d.clients as Client)?.name ?? d.client_name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{d.material_type ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {d.job_site_address
                          ? <a href={mapsUrl(d.job_site_address)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-900">{d.job_site_address}</a>
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatDate(d.scheduled_date)}{d.scheduled_time ? ` · ${d.scheduled_time}` : ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {d.billing_type === 'per_load'
                          ? `Per load${d.hours_per_load ? ` (${d.hours_per_load} hrs)` : ''}`
                          : d.billing_type === 'per_hour' ? 'Per hour' : '—'}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                      <td className="px-2 py-3">
                        <button
                          onClick={() => cancelDispatch(d.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Cancel dispatch"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* New Dispatch Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-base font-medium">New Dispatch</h2>
              <button onClick={() => { setShowModal(false); setFormError('') }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">

              {/* Client */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Client <span className="text-red-500">*</span></label>
                  <button
                    type="button"
                    onClick={() => setClientMode(m => m === 'existing' ? 'new' : 'existing')}
                    className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-800"
                  >
                    {clientMode === 'new' ? 'Select existing client' : 'Enter new client'}
                  </button>
                </div>
                {clientMode === 'existing' ? (
                  <>
                    <select
                      {...register('client_id', { required: clientMode === 'existing' })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="">Select client…</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {errors.client_id && <p className="text-xs text-red-600 mt-1">Required</p>}
                  </>
                ) : (
                  <>
                    <input
                      value={newClientName}
                      onChange={e => setNewClientName(e.target.value)}
                      placeholder="Client name"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    {clientMode === 'new' && !newClientName.trim() && submitting && (
                      <p className="text-xs text-red-600 mt-1">Required</p>
                    )}
                  </>
                )}
              </div>

              {/* Job Site Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Site Address</label>
                <input
                  {...register('job_site_address')}
                  placeholder="e.g. 4521 W Camelback Rd, Phoenix, AZ"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* Date + Arrival Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                  <input type="date" {...register('scheduled_date', { required: true })} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Time</label>
                  <input type="time" {...register('scheduled_time')} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
              </div>

              {/* Hauling */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What are you hauling?</label>
                <select {...register('hauling')} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Select…</option>
                  {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Billing Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">How are you charging? <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded border-2 cursor-pointer text-sm font-medium transition-colors ${billingType === 'per_load' ? 'border-[#1a1a1a] bg-gray-50 text-gray-900' : 'border-gray-200 text-gray-500'}`}>
                    <input type="radio" value="per_load" {...register('billing_type')} className="sr-only" />
                    Per Load
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded border-2 cursor-pointer text-sm font-medium transition-colors ${billingType === 'per_hour' ? 'border-[#1a1a1a] bg-gray-50 text-gray-900' : 'border-gray-200 text-gray-500'}`}>
                    <input type="radio" value="per_hour" {...register('billing_type')} className="sr-only" />
                    Per Hour
                  </label>
                </div>

                {billingType === 'per_load' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hours per load <span className="text-xs font-normal text-gray-400">(guaranteed — driver gets paid this even if they finish early)</span></label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="e.g. 4"
                      {...register('hours_per_load')}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                )}
              </div>

              {/* PO Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PO # <span className="text-xs font-normal text-gray-400">(optional — shown to driver when submitting invoice)</span></label>
                <input {...register('po_number')} placeholder="e.g. PO-10042" className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>

              {/* Assign Drivers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign Drivers <span className="text-red-500">*</span></label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
                  {drivers.map(driver => (
                    <label key={driver.id} className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={selectedDrivers.includes(driver.id)}
                        onChange={e => setSelectedDrivers(prev => e.target.checked ? [...prev, driver.id] : prev.filter(id => id !== driver.id))}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">{driver.full_name}{driver.truck_number ? ` (${driver.truck_number})` : ''}</span>
                    </label>
                  ))}
                </div>
                {selectedDrivers.length === 0 && <p className="text-xs text-red-600 mt-1">Select at least one driver</p>}
              </div>

              {/* Notes for Drivers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes for Drivers</label>
                <textarea {...register('notes')} rows={2} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" placeholder="Any special instructions…" />
              </div>

              {formError && <p className="text-xs text-red-600 -mt-1">{formError}</p>}

              <div className="flex gap-3 pt-2 pb-safe">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting || selectedDrivers.length === 0} className="flex-1 py-3 bg-[#1a1a1a] text-white rounded text-sm font-medium disabled:opacity-50">
                  {submitting ? 'Sending…' : 'Send Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
