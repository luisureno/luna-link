'use client'

import { useEffect, useMemo , useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Client } from '@/types'
import { AppLoader } from '@/components/AppLoader'

interface ClientForm {
  name: string
  contact_name: string
  contact_phone: string
  contact_email: string
  address: string
}

export default function ClientsPage() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientForm>()

  useEffect(() => {
    if (!profile?.company_id) return
    loadClients()
  }, [profile?.company_id])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').eq('company_id', profile!.company_id).order('name')
    setClients(data ?? [])
    setSelectedIds(new Set())
    setLoading(false)
  }

  async function onSubmit(data: ClientForm) {
    setSubmitting(true)
    await supabase.from('clients').insert({ company_id: profile!.company_id, ...data })
    setShowModal(false)
    reset()
    await loadClients()
    setSubmitting(false)
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds(prev => prev.size === clients.length ? new Set() : new Set(clients.map(c => c.id)))
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    const label = ids.length === 1 ? 'this client' : `these ${ids.length} clients`
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return

    setDeleting(true)
    const { error } = await supabase.from('clients').delete().in('id', ids)
    setDeleting(false)

    if (error) {
      if (error.code === '23503') {
        alert("Can't delete — one or more of these clients is still linked to dispatches, tickets, or invoices. Remove those first.")
      } else {
        alert(`Delete failed: ${error.message}`)
      }
      return
    }
    await loadClients()
  }

  if (loading) return <AppLoader />

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Companies you haul for"
        action={
          selectedIds.size > 0 ? (
            <button
              onClick={deleteSelected}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 size={16} /> {deleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
            </button>
          ) : (
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800">
              <Plus size={16} /> Add Client
            </button>
          )
        }
      />

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />)}</div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No clients yet. Add your first client above.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {clients.map(client => {
                const checked = selectedIds.has(client.id)
                return (
                  <label key={client.id} className={`flex items-start gap-3 p-4 cursor-pointer ${checked ? 'bg-gray-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelected(client.id)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{client.name}</p>
                      {client.contact_name && <p className="text-xs text-gray-600 mt-1">{client.contact_name}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        {client.contact_phone && <p className="text-xs text-gray-500">{client.contact_phone}</p>}
                        {client.contact_email && <p className="text-xs text-gray-500">{client.contact_email}</p>}
                      </div>
                      {client.address && <p className="text-xs text-gray-400 mt-1">{client.address}</p>}
                    </div>
                  </label>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={clients.length > 0 && selectedIds.size === clients.length}
                        onChange={toggleAll}
                        aria-label="Select all"
                        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Company</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Contact</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Phone</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Email</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clients.map(client => {
                    const checked = selectedIds.has(client.id)
                    return (
                      <tr key={client.id} className={checked ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelected(client.id)}
                            aria-label={`Select ${client.name}`}
                            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{client.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{client.contact_name ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{client.contact_phone ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{client.contact_email ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{client.address ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-base font-medium">Add Client</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name <span className="text-red-500">*</span></label>
                <input {...register('name', { required: true })} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
                {errors.name && <p className="text-xs text-red-600 mt-1">Required</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                <input {...register('contact_name')} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input {...register('contact_phone')} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" {...register('contact_email')} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input {...register('address')} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div className="flex gap-3 pt-2 pb-safe">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 border border-gray-300 rounded text-sm font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-3 bg-[#1a1a1a] text-white rounded text-sm font-medium disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
