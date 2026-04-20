import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('id')
  if (!invoiceId) return new Response('Missing id', { status: 400 })

  const { data: inv } = await supabase
    .from('invoices')
    .select('*, clients(*), companies(*)')
    .eq('id', invoiceId)
    .single()

  if (!inv) return new Response('Invoice not found', { status: 404 })

  const { data: tickets } = await supabase
    .from('load_tickets')
    .select('*, users(full_name)')
    .eq('company_id', (inv as any).company_id)
    .eq('client_id', (inv as any).client_id)
    .eq('status', 'invoiced')
    .eq('invoice_line_confirmed', true)
    .gte('submitted_at', `${(inv as any).date_from}T00:00:00`)
    .lte('submitted_at', `${(inv as any).date_to}T23:59:59`)
    .order('submitted_at')

  const { data: timesheets } = await supabase
    .from('daily_timesheets')
    .select('*, users(full_name)')
    .eq('company_id', (inv as any).company_id)
    .eq('client_id', (inv as any).client_id)
    .eq('status', 'invoiced')
    .gte('work_date', (inv as any).date_from)
    .lte('work_date', (inv as any).date_to)
    .order('work_date')

  const wb = new ExcelJS.Workbook()
  wb.creator = 'HaulProof'
  wb.created = new Date()

  // ── Sheet 1: Client Invoice ─────────────────────────────────────────────────
  const invoiceSheet = wb.addWorksheet('Client Invoice')
  invoiceSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Description', key: 'desc', width: 36 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Client Charge ($)', key: 'charge', width: 18 },
  ]
  invoiceSheet.getRow(1).font = { bold: true }
  invoiceSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } }
  invoiceSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  for (const t of tickets ?? []) {
    const r = t as any
    invoiceSheet.addRow({
      date: r.submitted_at?.split('T')[0] ?? '',
      driver: r.users?.full_name ?? '—',
      desc: r.billing_type === 'per_ton' ? `${r.weight_tons ?? '?'} tons${r.tag_number ? ` · Tag #${r.tag_number}` : ''}` : `${r.loads_count ?? 1} load(s)`,
      type: 'Load',
      charge: Number(r.client_charge_total ?? 0),
    })
  }
  for (const t of timesheets ?? []) {
    const r = t as any
    invoiceSheet.addRow({
      date: r.work_date ?? '',
      driver: r.users?.full_name ?? '—',
      desc: `${r.dispatcher_adjusted_hours ?? r.hours_billed_client ?? '?'}h on site`,
      type: 'Hourly',
      charge: Number(r.client_charge_total ?? 0),
    })
  }

  const totalCharge = [
    ...(tickets ?? []).map((t: any) => Number(t.client_charge_total ?? 0)),
    ...(timesheets ?? []).map((t: any) => Number(t.client_charge_total ?? 0)),
  ].reduce((s, v) => s + v, 0)

  const totalRow = invoiceSheet.addRow({ date: '', driver: '', desc: '', type: 'TOTAL', charge: totalCharge })
  totalRow.font = { bold: true }
  totalRow.getCell('charge').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } }

  invoiceSheet.getColumn('charge').numFmt = '"$"#,##0.00'

  // ── Sheet 2: Driver Pay ─────────────────────────────────────────────────────
  const paySheet = wb.addWorksheet('Driver Pay')
  paySheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Description', key: 'desc', width: 36 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Driver Pay ($)', key: 'pay', width: 16 },
    { header: 'Adjusted Pay ($)', key: 'adjusted', width: 18 },
    { header: 'Adjustment Reason', key: 'reason', width: 28 },
  ]
  paySheet.getRow(1).font = { bold: true }
  paySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } }
  paySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  for (const t of tickets ?? []) {
    const r = t as any
    paySheet.addRow({
      date: r.submitted_at?.split('T')[0] ?? '',
      driver: r.users?.full_name ?? '—',
      desc: r.billing_type === 'per_ton' ? `${r.weight_tons ?? '?'} tons` : `${r.loads_count ?? 1} load(s)`,
      type: 'Load',
      pay: Number(r.driver_pay_total ?? 0),
      adjusted: r.dispatcher_adjusted_pay != null ? Number(r.dispatcher_adjusted_pay) : null,
      reason: r.dispatcher_adjustment_reason ?? '',
    })
  }
  for (const t of timesheets ?? []) {
    const r = t as any
    paySheet.addRow({
      date: r.work_date ?? '',
      driver: r.users?.full_name ?? '—',
      desc: `${r.dispatcher_adjusted_hours ?? r.hours_worked ?? '?'}h`,
      type: 'Hourly',
      pay: Number(r.driver_pay_total ?? 0),
      adjusted: null,
      reason: r.dispatcher_adjustment_reason ?? '',
    })
  }

  paySheet.getColumn('pay').numFmt = '"$"#,##0.00'
  paySheet.getColumn('adjusted').numFmt = '"$"#,##0.00'

  // ── Sheet 3: Summary ────────────────────────────────────────────────────────
  const summarySheet = wb.addWorksheet('Summary')
  summarySheet.getColumn('A').width = 28
  summarySheet.getColumn('B').width = 18

  const meta = [
    ['Invoice #', (inv as any).invoice_number],
    ['Client', (inv as any).clients?.name ?? '—'],
    ['Period', `${(inv as any).date_from} to ${(inv as any).date_to}`],
    ['Generated', new Date().toLocaleDateString()],
    ['', ''],
    ['Total Load Lines', (tickets ?? []).length],
    ['Total Timesheet Lines', (timesheets ?? []).length],
    ['', ''],
    ['Total Client Charge', totalCharge],
  ]

  for (const [label, value] of meta) {
    const row = summarySheet.addRow([label, value])
    if (label === 'Total Client Charge') {
      row.font = { bold: true, size: 13 }
      row.getCell(2).numFmt = '"$"#,##0.00'
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${(inv as any).invoice_number}.xlsx"`,
    },
  })
}
