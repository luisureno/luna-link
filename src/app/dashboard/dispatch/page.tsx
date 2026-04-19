'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Dispatch, Client, JobSite, TicketTemplate, User } from '@/types'

interface DispatchForm {
  title: string
  client_id: string
  job_site_id: string
  ticket_template_id: string
  scheduled_date: string
  scheduled_time: string
  notes: string
}

export default function DispatchPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [showModal, setShowModal] = useState(false)
  const [dispatches, setDispatches] = useState<(Dispatch & { clients: Client; job_sites: JobSite })[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [jobSites, setJobSites] = useState<JobSite[]>([])
  const [templates, setTemplates] = useState<TicketTemplate[]>([])
  const [drivers, setDrivers] = useState<User[]>([])
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DispatchForm>({
    defaultValues: { scheduled_date: new Date().toISOString().split('T')[0] }
  })

  useEffect(() => {
    if (!profile?.company_id) return
    loadData()
  }, [profile?.company_id])

  async function loadData() {
    const cid = profile!.company_id
    const today = new Date().toISOString().split('T')[0]

    const [dispatchesRes, clientsRes, jobSitesRes, templatesRes, driversRes] = await Promise.all([
      supabase.from('dispatches').select('*, clients(*), job_sites(*)').eq('company_id', cid).gte('scheduled_date', today).order('scheduled_date'),
      supabase.from('clients').select('*').eq('company_id', cid).order('name'),
      supabase.from('job_sites').select('*').eq('company_id', cid).eq('is_active', true).order('name'),
      supabase.from('ticket_templates').select('*').eq('company_id', cid).eq('is_active', true),
      supabase.from('users').select('*').eq('company_id', cid).eq('role', 'driver').eq('is_active', true).order('full_name'),
    ])

    setDispatches((dispatchesRes.data ?? []) as any)
    setClients(clientsRes.data ?? [])
    setJobSites(jobSitesRes.data ?? [])
    setTemplates(templatesRes.data ?? [])
    setDrivers(driversRes.data ?? [])
    setLoading(false)
  }

  async function onSubmit(data: DispatchForm) {
    if (selectedDrivers.length === 0) return
    setSubmitting(true)

    const { data: dispatch } = await supabase.from('dispatches').insert({
      company_id: profile!.company_id,
      dispatcher_id: profile!.id,
      ...data,
      scheduled_time: data.scheduled_time || null,
      notes: data.notes || null,
      status: 'pending',
    }).select().single()

    if (dispatch) {
      await supabase.from('dispatch_assignments').insert(
        selectedDrivers.map(driver_id => ({ dispatch_id: dispatch.id, driver_id, status: 'assigned' }))
      )
      // Stub: notify drivers (Twilio wired up later)
      selectedDrivers.forEach(id => console.log(`[SMS stub] Notify driver ${id} of dispatch ${dispatch.id}`))
    }

    setShowModal(false)
    reset()
    setSelectedDrivers([])
    setSelectedClientId('')
    await loadData()
    setSubmitting(false)
  }

  const filteredJobSites = selectedClientId ? jobSites.filter(js => js.client_id === selectedClientId) : jobSites

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

      {/* Dispatches Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        {loading ? (
          <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />)}</div>
        ) : dispatches.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No dispatches yet. Create your first dispatch above.</p>
          </div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Title</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dispatches.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{(d.clients as Client)?.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{d.scheduled_date}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Dispatch Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-base font-medium">New Dispatch</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input {...register('title', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="e.g. Morning run – Riverside Site" />
                {errors.title && <p className="text-xs text-red-600 mt-1">Required</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client <span className="text-red-500">*</span></label>
                <select {...register('client_id', { required: true })} onChange={e => setSelectedClientId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Site <span className="text-red-500">*</span></label>
                <select {...register('job_site_id', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Select job site...</option>
                  {filteredJobSites.map(js => <option key={js.id} value={js.id}>{js.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Template <span className="text-red-500">*</span></label>
                <select {...register('ticket_template_id', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Select template...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                  <input type="date" {...register('scheduled_date', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input type="time" {...register('scheduled_time')} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign Drivers <span className="text-red-500">*</span></label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
                  {drivers.map(driver => (
                    <label key={driver.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={selectedDrivers.includes(driver.id)}
                        onChange={e => setSelectedDrivers(prev => e.target.checked ? [...prev, driver.id] : prev.filter(id => id !== driver.id))}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">{driver.full_name} ({driver.truck_number})</span>
                    </label>
                  ))}
                </div>
                {selectedDrivers.length === 0 && <p className="text-xs text-red-600 mt-1">Select at least one driver</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes for Drivers</label>
                <textarea {...register('notes')} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" placeholder="Any special instructions..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting || selectedDrivers.length === 0} className="flex-1 py-2 bg-[#1a1a1a] text-white rounded text-sm font-medium disabled:opacity-50">
                  {submitting ? 'Sending...' : 'Send Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
