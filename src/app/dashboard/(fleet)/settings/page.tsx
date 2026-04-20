'use client'

import { useEffect, useState } from 'react'
import { Plus, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { BillingSetupTab } from '@/components/settings/BillingSetupTab'
import type { User, TicketTemplate, TemplateField, FieldType } from '@/types'

const tabs = ['Company', 'Users', 'Ticket Templates', 'Job Sites', 'Billing Setup']
const fieldTypes: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text Input' },
  { value: 'number', label: 'Number Input' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'photo', label: 'Photo Attachment' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date/Time' },
  { value: 'signature', label: 'Signature' },
]

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function SettingsPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [tab, setTab] = useState('Company')
  const [users, setUsers] = useState<User[]>([])
  const [templates, setTemplates] = useState<TicketTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TicketTemplate | null>(null)
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([])
  const [templateName, setTemplateName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [editingPayUserId, setEditingPayUserId] = useState<string | null>(null)
  const [payType, setPayType] = useState<'per_load' | 'hourly'>('per_load')
  const [payRate, setPayRate] = useState('')
  const [savingPay, setSavingPay] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { register: registerUser, handleSubmit: handleUserSubmit, reset: resetUser } = useForm<{ full_name: string; email: string; phone: string; role: string; truck_number: string }>()
  const { register: registerCompany, handleSubmit: handleCompanySubmit } = useForm({ defaultValues: { name: '', address: '', phone: '' } })

  useEffect(() => {
    if (!profile?.company_id) return
    loadData()
  }, [profile?.company_id])

  async function loadData() {
    const cid = profile!.company_id
    const [usersRes, templatesRes, companyRes] = await Promise.all([
      supabase.from('users').select('*').eq('company_id', cid).order('full_name'),
      supabase.from('ticket_templates').select('*').eq('company_id', cid).order('name'),
      supabase.from('companies').select('invite_token').eq('id', cid).single(),
    ])
    setUsers(usersRes.data ?? [])
    setTemplates(templatesRes.data ?? [])
    setInviteToken((companyRes.data as any)?.invite_token ?? null)
  }

  async function copyInviteLink() {
    if (!inviteToken) return
    const url = `${window.location.origin}/join/${inviteToken}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveCompany(data: any) {
    setSaving(true)
    await supabase.from('companies').update(data).eq('id', profile!.company_id)
    setSaving(false)
  }

  function startEditPay(u: User) {
    setEditingPayUserId(u.id)
    setPayType(u.pay_type ?? 'per_load')
    setPayRate(u.pay_rate != null ? String(u.pay_rate) : '')
  }

  async function savePayRate(userId: string) {
    setSavingPay(true)
    await supabase.from('users').update({ pay_type: payType, pay_rate: payRate ? parseFloat(payRate) : null }).eq('id', userId)
    setEditingPayUserId(null)
    await loadData()
    setSavingPay(false)
  }

  async function inviteUser(data: any) {
    setInviting(true)
    await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        full_name: data.full_name,
        phone: data.phone || null,
        role: data.role,
        truck_number: data.truck_number || null,
        company_id: profile!.company_id,
      }),
    })
    setShowUserModal(false)
    resetUser()
    await loadData()
    setInviting(false)
  }

  function addField(type: FieldType) {
    setTemplateFields(prev => [...prev, { id: generateId(), label: `New ${type} field`, type, required: false, options: type === 'dropdown' ? ['Option 1'] : undefined }])
  }

  function updateField(id: string, changes: Partial<TemplateField>) {
    setTemplateFields(prev => prev.map(f => f.id === id ? { ...f, ...changes } : f))
  }

  function moveField(id: string, dir: -1 | 1) {
    const idx = templateFields.findIndex(f => f.id === id)
    if (idx + dir < 0 || idx + dir >= templateFields.length) return
    const next = [...templateFields]
    ;[next[idx], next[idx + dir]] = [next[idx + dir], next[idx]]
    setTemplateFields(next)
  }

  function removeField(id: string) {
    setTemplateFields(prev => prev.filter(f => f.id !== id))
  }

  async function saveTemplate() {
    if (!templateName) return
    setSaving(true)
    if (selectedTemplate) {
      await supabase.from('ticket_templates').update({ name: templateName, fields: templateFields }).eq('id', selectedTemplate.id)
    } else {
      await supabase.from('ticket_templates').insert({ company_id: profile!.company_id, name: templateName, fields: templateFields })
    }
    setSelectedTemplate(null)
    setTemplateFields([])
    setTemplateName('')
    await loadData()
    setSaving(false)
  }

  function editTemplate(t: TicketTemplate) {
    setSelectedTemplate(t)
    setTemplateName(t.name)
    setTemplateFields(t.fields)
  }

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-[#1a1a1a] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Company Tab */}
      {tab === 'Company' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-lg">
          <h2 className="text-base font-medium mb-4">Company Info</h2>
          <form onSubmit={handleCompanySubmit(saveCompany)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input {...registerCompany('name')} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input {...registerCompany('address')} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input {...registerCompany('phone')} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'Users' && (
        <div>
          {inviteToken && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Driver invite link</h3>
              <p className="text-xs text-gray-500 mb-3">Share this with new drivers. They register on their phone and join your company automatically.</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/join/${inviteToken}` : ''}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 bg-gray-50 font-mono"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button onClick={copyInviteLink} className="px-4 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800 whitespace-nowrap">
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end mb-4">
            <button onClick={() => setShowUserModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800">
              <Plus size={16} /> Add User
            </button>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {users.map(u => (
                <div key={u.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                      <p className="text-xs text-gray-500 capitalize mt-0.5">{u.role}{u.truck_number ? ` · Truck ${u.truck_number}` : ''}</p>
                      {u.pay_type && <p className="text-xs text-gray-400 mt-0.5 capitalize">{u.pay_type.replace('_', ' ')}{u.pay_rate != null ? ` · $${Number(u.pay_rate).toFixed(2)}` : ''}</p>}
                    </div>
                    {u.role === 'driver' && (
                      <button onClick={() => editingPayUserId === u.id ? setEditingPayUserId(null) : startEditPay(u)} className="text-xs text-gray-500 hover:text-gray-900 underline flex-shrink-0">
                        {editingPayUserId === u.id ? 'Cancel' : 'Set Pay'}
                      </button>
                    )}
                  </div>
                  {editingPayUserId === u.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
                      <select value={payType} onChange={e => setPayType(e.target.value as 'per_load' | 'hourly')} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 bg-white">
                        <option value="per_load">Per Load</option>
                        <option value="hourly">Hourly</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">$</span>
                        <input type="number" step="0.01" min="0" value={payRate} onChange={e => setPayRate(e.target.value)} placeholder={payType === 'per_load' ? '0.00 per load' : '0.00 per hour'} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
                        <button onClick={() => savePayRate(u.id)} disabled={savingPay} className="px-3 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800 disabled:opacity-50">
                          {savingPay ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Role</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Truck</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Pay Type</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Rate</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(u => (
                    <>
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.full_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 capitalize">{u.role}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{u.truck_number ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 capitalize">{u.pay_type?.replace('_', ' ') ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{u.pay_rate != null ? `$${Number(u.pay_rate).toFixed(2)}` : '—'}</td>
                        <td className="px-4 py-3">
                          {u.role === 'driver' && (
                            <button onClick={() => editingPayUserId === u.id ? setEditingPayUserId(null) : startEditPay(u)} className="text-xs text-gray-500 hover:text-gray-900 underline">
                              {editingPayUserId === u.id ? 'Cancel' : 'Set Pay'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {editingPayUserId === u.id && (
                        <tr key={`${u.id}-pay`} className="bg-gray-50">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <select value={payType} onChange={e => setPayType(e.target.value as 'per_load' | 'hourly')} className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white">
                                <option value="per_load">Per Load</option>
                                <option value="hourly">Hourly</option>
                              </select>
                              <div className="flex items-center gap-1">
                                <span className="text-sm text-gray-500">$</span>
                                <input type="number" step="0.01" min="0" value={payRate} onChange={e => setPayRate(e.target.value)} placeholder={payType === 'per_load' ? '0.00 per load' : '0.00 per hour'} className="w-36 px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
                              </div>
                              <button onClick={() => savePayRate(u.id)} disabled={savingPay} className="px-3 py-1.5 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800 disabled:opacity-50">
                                {savingPay ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Templates Tab */}
      {tab === 'Ticket Templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="col-span-1">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <span className="text-sm font-medium">Templates</span>
                <button onClick={() => { setSelectedTemplate(null); setTemplateName(''); setTemplateFields([]) }} className="text-xs text-gray-500 hover:text-gray-700">+ New</button>
              </div>
              {templates.map(t => (
                <button key={t.id} onClick={() => editTemplate(t)} className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 hover:bg-gray-50 ${selectedTemplate?.id === t.id ? 'bg-gray-100' : ''}`}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-5">
            <div className="mb-4">
              <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name..." className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>

            <div className="space-y-2 mb-4">
              {templateFields.map((field, idx) => (
                <div key={field.id} className="flex items-center gap-2 p-3 border border-gray-200 rounded bg-gray-50">
                  <div className="flex-1 space-y-1.5">
                    <input value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded">{field.type}</span>
                      <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} className="w-3 h-3" />
                        Required
                      </label>
                    </div>
                    {field.type === 'dropdown' && (
                      <textarea
                        value={field.options?.join('\n') ?? ''}
                        onChange={e => updateField(field.id, { options: e.target.value.split('\n').filter(Boolean) })}
                        placeholder="One option per line"
                        rows={2}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs resize-none"
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveField(field.id, -1)} disabled={idx === 0} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button onClick={() => moveField(field.id, 1)} disabled={idx === templateFields.length - 1} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"><ChevronDown size={14} /></button>
                    <button onClick={() => removeField(field.id)} className="p-1 hover:bg-red-100 text-red-500 rounded"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <select className="px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none" id="field-type-select">
                {fieldTypes.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
              </select>
              <button
                onClick={() => {
                  const sel = (document.getElementById('field-type-select') as HTMLSelectElement).value as FieldType
                  addField(sel)
                }}
                className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                <Plus size={14} /> Add Field
              </button>
            </div>

            <button onClick={saveTemplate} disabled={saving || !templateName} className="px-4 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      )}

      {/* Job Sites Tab */}
      {tab === 'Job Sites' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm text-gray-500">Job sites are managed per client. Go to <strong>Clients</strong> and click a client to manage their job sites.</p>
        </div>
      )}

      {/* Billing Setup Tab */}
      {tab === 'Billing Setup' && <BillingSetupTab />}

      {/* Add User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-base font-medium">Add User</h2>
              <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleUserSubmit(inviteUser)} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input {...registerUser('full_name', { required: true })} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" {...registerUser('email', { required: true })} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input {...registerUser('phone')} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                <select {...registerUser('role', { required: true })} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="driver">Driver</option>
                  <option value="dispatcher">Dispatcher</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Truck Number</label>
                <input {...registerUser('truck_number')} className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="e.g. T-101" />
              </div>
              <div className="flex gap-3 pt-2 pb-safe">
                <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 py-3 border border-gray-300 rounded text-sm font-medium">Cancel</button>
                <button type="submit" disabled={inviting} className="flex-1 py-3 bg-[#1a1a1a] text-white rounded text-sm font-medium disabled:opacity-50">
                  {inviting ? 'Creating...' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
