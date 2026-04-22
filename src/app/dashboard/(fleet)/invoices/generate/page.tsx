'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, CheckCircle, FileText, Download, X, ArrowLeftRight, Plus, Trash2 } from 'lucide-react'
import Decimal from 'decimal.js'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'

type Step = 'filter' | 'review' | 'summary'
type LineType = 'ticket' | 'timesheet'

interface Client { id: string; name: string; address: string | null }

interface Line {
  id: string
  type: LineType
  date: string
  driver_name: string
  description: string
  client_charge: number
  driver_pay: number
  included: boolean
  notes: string
}

interface CustomItem {
  id: string
  label: string
  amount: number
}

interface FilterState {
  client_id: string
  date_from: string
  date_to: string
  include_tickets: boolean
  include_timesheets: boolean
}

function dateRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: first.toISOString().split('T')[0],
    to: last.toISOString().split('T')[0],
  }
}

function uid() {
  return Math.random().toString(36).slice(2)
}

export default function GenerateInvoicePage() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const range = dateRange()

  const [step, setStep] = useState<Step>('filter')
  const [clients, setClients] = useState<Client[]>([])
  const [filter, setFilter] = useState<FilterState>({
    client_id: '',
    date_from: range.from,
    date_to: range.to,
    include_tickets: true,
    include_timesheets: true,
  })

  // Invoice metadata fields
  const [clientAddress, setClientAddress] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')

  const [lines, setLines] = useState<Line[]>([])
  const [customItems, setCustomItems] = useState<CustomItem[]>([])

  const [loading, setLoading] = useState(false)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)

  useEffect(() => {
    if (!profile?.company_id) return
    supabase.from('clients').select('id, name, address').eq('company_id', profile.company_id).order('name')
      .then(({ data }) => setClients((data ?? []) as Client[]))
  }, [profile?.company_id])

  // Auto-fill billing address when client is picked
  function onClientChange(id: string) {
    setFilter(prev => ({ ...prev, client_id: id }))
    const client = clients.find(c => c.id === id)
    setClientAddress(client?.address ?? '')
  }

  async function loadLines() {
    if (!filter.client_id) return
    setLoading(true)

    const ticketLines: Line[] = []
    const timesheetLines: Line[] = []

    if (filter.include_tickets) {
      const { data } = await supabase
        .from('load_tickets')
        .select('id, submitted_at, client_charge_total, driver_pay_total, dispatcher_adjusted_pay, billing_type, loads_count, weight_tons, tag_number, invoice_line_confirmed, users(full_name)')
        .eq('company_id', profile!.company_id)
        .eq('client_id', filter.client_id)
        .in('status', ['confirmed'])
        .eq('invoice_line_confirmed', false)
        .gte('submitted_at', `${filter.date_from}T00:00:00`)
        .lte('submitted_at', `${filter.date_to}T23:59:59`)
        .order('submitted_at')

      for (const t of data ?? []) {
        const r = t as any
        const desc = r.billing_type === 'per_ton'
          ? `${r.weight_tons ?? '?'} tons${r.tag_number ? ` · Tag #${r.tag_number}` : ''}`
          : r.billing_type === 'per_load'
          ? `${r.loads_count ?? 1} load(s)`
          : 'Load ticket'

        ticketLines.push({
          id: r.id,
          type: 'ticket',
          date: r.submitted_at.split('T')[0],
          driver_name: (r.users as any)?.full_name ?? '—',
          description: desc,
          client_charge: Number(r.client_charge_total ?? 0),
          driver_pay: Number(r.dispatcher_adjusted_pay ?? r.driver_pay_total ?? 0),
          included: true,
          notes: '',
        })
      }
    }

    if (filter.include_timesheets) {
      const { data } = await supabase
        .from('daily_timesheets')
        .select('id, work_date, client_charge_total, driver_pay_total, hours_billed_client, dispatcher_adjusted_hours, users(full_name)')
        .eq('company_id', profile!.company_id)
        .eq('client_id', filter.client_id)
        .in('status', ['confirmed'])
        .gte('work_date', filter.date_from)
        .lte('work_date', filter.date_to)
        .order('work_date')

      for (const t of data ?? []) {
        const r = t as any
        const hrs = r.dispatcher_adjusted_hours ?? r.hours_billed_client ?? '?'

        timesheetLines.push({
          id: r.id,
          type: 'timesheet',
          date: r.work_date,
          driver_name: (r.users as any)?.full_name ?? '—',
          description: `${hrs}h on site`,
          client_charge: Number(r.client_charge_total ?? 0),
          driver_pay: Number(r.driver_pay_total ?? 0),
          included: true,
          notes: '',
        })
      }
    }

    setLines([...ticketLines, ...timesheetLines])
    setLoading(false)
    setStep('review')
  }

  function toggleLine(id: string) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, included: !l.included } : l))
  }
  function updateLineNotes(id: string, notes: string) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, notes } : l))
  }
  function updateLineCharge(id: string, charge: string) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, client_charge: parseFloat(charge) || 0 } : l))
  }

  function addCustomItem() {
    setCustomItems(prev => [...prev, { id: uid(), label: '', amount: 0 }])
  }
  function updateCustomItem(id: string, field: 'label' | 'amount', value: string) {
    setCustomItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, [field]: field === 'amount' ? parseFloat(value) || 0 : value }
        : item
    ))
  }
  function removeCustomItem(id: string) {
    setCustomItems(prev => prev.filter(item => item.id !== id))
  }

  const includedLines = lines.filter(l => l.included)
  const customTotal = customItems.reduce((s, i) => new Decimal(s).plus(i.amount).toNumber(), 0)
  const totalCharge = new Decimal(
    includedLines.reduce((s, l) => new Decimal(s).plus(l.client_charge).toNumber(), 0)
  ).plus(customTotal).toNumber()
  const totalDriverPay = includedLines.reduce((s, l) => new Decimal(s).plus(l.driver_pay).toNumber(), 0)

  async function createInvoice() {
    if (includedLines.length === 0 && customItems.length === 0) return
    if (!filter.client_id) return
    setCreating(true)

    const now = new Date()
    const invNum = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`

    const { data: inv, error } = await supabase.from('invoices').insert({
      company_id: profile!.company_id,
      client_id: filter.client_id,
      invoice_number: invNum,
      invoice_type: 'client_invoice',
      status: 'draft',
      total_amount: totalCharge,
      total_loads: includedLines.filter(l => l.type === 'ticket').length,
      lines_total: includedLines.length + customItems.length,
      lines_confirmed: includedLines.length + customItems.length,
      date_from: filter.date_from,
      date_to: filter.date_to,
      client_address: clientAddress || null,
      origin: origin || null,
      destination: destination || null,
      custom_items: customItems.length > 0
        ? customItems.map(({ label, amount }) => ({ label, amount }))
        : [],
    }).select().single()

    if (error || !inv) { setCreating(false); return }

    const ticketIds = includedLines.filter(l => l.type === 'ticket').map(l => l.id)
    if (ticketIds.length > 0) {
      await supabase.from('load_tickets').update({
        status: 'invoiced',
        invoice_line_confirmed: true,
        invoice_line_confirmed_at: now.toISOString(),
        invoice_line_confirmed_by: profile!.id,
      }).in('id', ticketIds)
    }

    const tsIds = includedLines.filter(l => l.type === 'timesheet').map(l => l.id)
    if (tsIds.length > 0) {
      await supabase.from('daily_timesheets').update({ status: 'invoiced' }).in('id', tsIds)
    }

    setInvoiceId((inv as any).id)
    setInvoiceNumber(invNum)
    setCreating(false)
    setStep('summary')
  }

  async function downloadPdf() {
    if (!invoiceId) return
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/invoice/pdf?id=${invoiceId}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoiceNumber ?? 'invoice'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setPdfLoading(false)
    }
  }

  async function downloadExcel() {
    if (!invoiceId) return
    setExcelLoading(true)
    try {
      const res = await fetch(`/api/invoice/excel?id=${invoiceId}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoiceNumber ?? 'invoice'}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExcelLoading(false)
    }
  }

  // ── STEP 1: FILTER ───────────────────────────────────────────────────────────
  if (step === 'filter') {
    const selectedClient = clients.find(c => c.id === filter.client_id)

    return (
      <div className="max-w-lg mx-auto p-4 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Generate Invoice</h1>
            <p className="text-sm text-gray-500">Step 1 of 3 — Select period & client</p>
          </div>
        </div>

        {/* Client + billing address */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bill To</p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Client</label>
            <select
              value={filter.client_id}
              onChange={e => onClientChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              <option value="">Select a client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Billing address</label>
            <textarea
              rows={2}
              value={clientAddress}
              onChange={e => setClientAddress(e.target.value)}
              placeholder="123 Main St, Phoenix, AZ 85001"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
          </div>
        </div>

        {/* Origin → Destination */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Haul Route</p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Point of origin</label>
            <input
              type="text"
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              placeholder="e.g. Mesa Rock Quarry, Mesa AZ"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200" />
            <button
              type="button"
              onClick={() => {
                const tmp = origin
                setOrigin(destination)
                setDestination(tmp)
              }}
              title="Swap origin and destination"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 shrink-0"
            >
              <ArrowLeftRight size={13} />
              Swap
            </button>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Destination</label>
            <input
              type="text"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="e.g. Scottsdale Job Site, Scottsdale AZ"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>

        {/* Date range + include */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">From</label>
              <input type="date" value={filter.date_from} onChange={e => setFilter(prev => ({ ...prev, date_from: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">To</label>
              <input type="date" value={filter.date_to} onChange={e => setFilter(prev => ({ ...prev, date_to: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">Include</label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={filter.include_tickets} onChange={e => setFilter(prev => ({ ...prev, include_tickets: e.target.checked }))} className="w-4 h-4" />
              Load tickets (per-load & per-ton)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={filter.include_timesheets} onChange={e => setFilter(prev => ({ ...prev, include_timesheets: e.target.checked }))} className="w-4 h-4" />
              Timesheets (hourly)
            </label>
          </div>
        </div>

        <button
          onClick={loadLines}
          disabled={!filter.client_id || loading || (!filter.include_tickets && !filter.include_timesheets)}
          className="w-full py-3 bg-[#1a1a1a] text-white rounded-xl font-medium disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {loading
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : 'Load Lines →'}
        </button>
      </div>
    )
  }

  // ── STEP 2: REVIEW LINES ─────────────────────────────────────────────────────
  if (step === 'review') {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('filter')} className="text-gray-500 hover:text-gray-900">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Review Lines</h1>
            <p className="text-sm text-gray-500">Step 2 of 3 — {lines.length} line(s) found · {filter.date_from} to {filter.date_to}</p>
          </div>
        </div>

        {lines.length === 0 && customItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">No confirmed, uninvoiced tickets or timesheets found for this client and period.</p>
            <button onClick={() => setStep('filter')} className="mt-4 text-sm text-blue-600 hover:underline">Change filters</button>
          </div>
        ) : (
          <>
            {/* Ticket / timesheet lines */}
            {lines.length > 0 && (
              <div className="space-y-2">
                {lines.map(line => (
                  <div key={line.id} className={`bg-white border rounded-xl p-4 transition-opacity ${line.included ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={line.included}
                        onChange={() => toggleLine(line.id)}
                        className="mt-0.5 w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{line.driver_name}</p>
                            <p className="text-xs text-gray-500">{line.date} · {line.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-gray-500">Client charge</p>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.client_charge}
                              onChange={e => updateLineCharge(line.id, e.target.value)}
                              className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-sm font-semibold text-blue-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                            />
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-xs text-green-600">Driver pay: ${line.driver_pay.toFixed(2)}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border ${line.type === 'ticket' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                            {line.type === 'ticket' ? 'Load' : 'Hourly'}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={line.notes}
                          onChange={e => updateLineNotes(line.id, e.target.value)}
                          placeholder="Add note to this line…"
                          className="mt-2 w-full text-xs border border-gray-100 rounded px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Custom / additional items */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Additional items</p>
                  <p className="text-xs text-gray-500">Fuel surcharge, disposal fee, equipment rental, etc.</p>
                </div>
                <button
                  type="button"
                  onClick={addCustomItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Plus size={13} /> Add item
                </button>
              </div>

              {customItems.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">No additional items. Click "Add item" to add one.</p>
              ) : (
                <div className="space-y-2">
                  {customItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.label}
                        onChange={e => updateCustomItem(item.id, 'label', e.target.value)}
                        placeholder="Item label (e.g. Fuel surcharge)"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                      <div className="relative shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.amount || ''}
                          onChange={e => updateCustomItem(item.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          className="w-28 pl-7 border border-gray-200 rounded-lg px-3 py-2 text-sm text-right font-semibold text-blue-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomItem(item.id)}
                        className="p-2 text-gray-400 hover:text-red-500 shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-medium text-gray-700 pt-1 border-t border-gray-100">
                    <span>Additional items subtotal</span>
                    <span>${customTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Totals sticky footer */}
            <div className="sticky bottom-0 bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Lines included</span>
                <span className="font-medium">{includedLines.length}{customItems.length > 0 ? ` + ${customItems.length} custom` : ''}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-600">Total client charge</span>
                <span className="font-bold text-blue-700">${totalCharge.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Total driver pay</span>
                <span className="font-medium text-green-700">${totalDriverPay.toFixed(2)}</span>
              </div>
              <button
                onClick={() => setStep('summary')}
                disabled={includedLines.length === 0 && customItems.length === 0}
                className="w-full py-3 bg-[#1a1a1a] text-white rounded-xl font-medium disabled:opacity-40"
              >
                Review Summary →
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── STEP 3: SUMMARY + CREATE ─────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {!invoiceId ? (
        <>
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('review')} className="text-gray-500 hover:text-gray-900">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Invoice Summary</h1>
              <p className="text-sm text-gray-500">Step 3 of 3 — Review and confirm</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Client</span>
              <span className="font-medium">{clients.find(c => c.id === filter.client_id)?.name ?? '—'}</span>
            </div>
            {clientAddress && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Billing address</span>
                <span className="font-medium text-right max-w-[60%]">{clientAddress}</span>
              </div>
            )}
            {(origin || destination) && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Route</span>
                <span className="font-medium text-right max-w-[60%]">
                  {[origin, destination].filter(Boolean).join(' → ')}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Period</span>
              <span className="font-medium">{filter.date_from} → {filter.date_to}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Lines</span>
              <span className="font-medium">{includedLines.length}{customItems.length > 0 ? ` + ${customItems.length} custom` : ''}</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
              <span className="text-blue-600 font-medium">Client invoice total</span>
              <span className="font-bold text-blue-700 text-base">${totalCharge.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-green-600 font-medium">Total driver pay</span>
              <span className="font-medium text-green-700">${totalDriverPay.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Gross margin</span>
              <span className="font-medium text-gray-900">
                ${new Decimal(totalCharge).minus(totalDriverPay).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            Clicking "Create Invoice" will lock these lines and mark them as invoiced.
          </div>

          <button
            onClick={createInvoice}
            disabled={creating || (includedLines.length === 0 && customItems.length === 0)}
            className="w-full py-3 bg-[#1a1a1a] text-white rounded-xl font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {creating
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : 'Create Invoice ✓'}
          </button>
        </>
      ) : (
        <>
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Invoice Created</h2>
            <p className="text-gray-500 text-sm">{invoiceNumber}</p>
            <p className="text-2xl font-bold text-blue-700 mt-2">${totalCharge.toFixed(2)}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={downloadPdf}
              disabled={pdfLoading}
              className="w-full flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 disabled:opacity-40"
            >
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-red-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">Download PDF</p>
                <p className="text-xs text-gray-500">Client invoice with all line items</p>
              </div>
              {pdfLoading && <span className="ml-auto w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
            </button>

            <button
              onClick={downloadExcel}
              disabled={excelLoading}
              className="w-full flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 disabled:opacity-40"
            >
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">Export to Excel</p>
                <p className="text-xs text-gray-500">3 sheets: formatted invoice, raw load tickets, raw timesheets</p>
              </div>
              {excelLoading && <span className="ml-auto w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
            </button>
          </div>

          <button
            onClick={() => router.push('/dashboard/invoices')}
            className="w-full py-3 text-sm text-gray-600 hover:text-gray-900"
          >
            Back to Invoices
          </button>
        </>
      )}
    </div>
  )
}
