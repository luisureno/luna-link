export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('from')
  const dateTo = searchParams.get('to')
  if (!dateFrom || !dateTo) return new Response('Missing from/to', { status: 400 })

  const [{ data: tickets }, { data: timesheets }] = await Promise.all([
    supabase
      .from('load_tickets')
      .select('*, users(id, full_name)')
      .in('status', ['confirmed', 'invoiced'])
      .gte('submitted_at', `${dateFrom}T00:00:00`)
      .lte('submitted_at', `${dateTo}T23:59:59`),
    supabase
      .from('daily_timesheets')
      .select('*, users(id, full_name)')
      .in('status', ['confirmed', 'invoiced'])
      .gte('work_date', dateFrom)
      .lte('work_date', dateTo),
  ])

  const wb = new ExcelJS.Workbook()
  wb.creator = 'FleetWise'

  // ── Sheet 1: All Lines ──────────────────────────────────────────────────────
  const allSheet = wb.addWorksheet('All Lines')
  allSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Description', key: 'desc', width: 34 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Original Pay ($)', key: 'pay', width: 16 },
    { header: 'Adjusted Pay ($)', key: 'adjusted', width: 16 },
    { header: 'Adj. Reason', key: 'reason', width: 28 },
    { header: 'Final Pay ($)', key: 'final', width: 14 },
  ]
  allSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  allSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } }

  for (const t of tickets ?? []) {
    const r = t as any
    const pay = Number(r.driver_pay_total ?? 0)
    const adj = r.dispatcher_adjusted_pay != null ? Number(r.dispatcher_adjusted_pay) : null
    allSheet.addRow({
      date: r.submitted_at?.split('T')[0] ?? '',
      driver: r.users?.full_name ?? '—',
      desc: r.billing_type === 'per_ton' ? `${r.weight_tons ?? '?'} tons${r.tag_number ? ` · Tag #${r.tag_number}` : ''}` : `${r.loads_count ?? 1} loads`,
      type: 'Load',
      pay,
      adjusted: adj,
      reason: r.dispatcher_adjustment_reason ?? '',
      final: adj ?? pay,
    })
  }
  for (const t of timesheets ?? []) {
    const r = t as any
    const pay = Number(r.driver_pay_total ?? 0)
    allSheet.addRow({
      date: r.work_date ?? '',
      driver: r.users?.full_name ?? '—',
      desc: `${r.dispatcher_adjusted_hours ?? r.hours_paid_driver ?? '?'}h on site`,
      type: 'Hourly',
      pay,
      adjusted: null,
      reason: r.dispatcher_adjustment_reason ?? '',
      final: pay,
    })
  }
  ;['pay', 'adjusted', 'final'].forEach(k => { allSheet.getColumn(k).numFmt = '"$"#,##0.00' })

  // ── Sheet 2: By Driver ──────────────────────────────────────────────────────
  const byDriverSheet = wb.addWorksheet('By Driver')
  byDriverSheet.columns = [
    { header: 'Driver', key: 'driver', width: 24 },
    { header: 'Load Lines', key: 'ticket_count', width: 12 },
    { header: 'Timesheet Lines', key: 'ts_count', width: 16 },
    { header: 'Load Pay ($)', key: 'ticket_pay', width: 14 },
    { header: 'Hourly Pay ($)', key: 'ts_pay', width: 14 },
    { header: 'Total Pay ($)', key: 'total', width: 14 },
  ]
  byDriverSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  byDriverSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } }

  const driverMap = new Map<string, { name: string; ticket_count: number; ts_count: number; ticket_pay: number; ts_pay: number }>()
  for (const t of tickets ?? []) {
    const r = t as any
    const uid = r.users?.id ?? 'unknown'
    if (!driverMap.has(uid)) driverMap.set(uid, { name: r.users?.full_name ?? '—', ticket_count: 0, ts_count: 0, ticket_pay: 0, ts_pay: 0 })
    const d = driverMap.get(uid)!
    d.ticket_count++
    d.ticket_pay += Number(r.dispatcher_adjusted_pay ?? r.driver_pay_total ?? 0)
  }
  for (const t of timesheets ?? []) {
    const r = t as any
    const uid = r.users?.id ?? 'unknown'
    if (!driverMap.has(uid)) driverMap.set(uid, { name: r.users?.full_name ?? '—', ticket_count: 0, ts_count: 0, ticket_pay: 0, ts_pay: 0 })
    const d = driverMap.get(uid)!
    d.ts_count++
    d.ts_pay += Number(r.driver_pay_total ?? 0)
  }
  for (const d of driverMap.values()) {
    byDriverSheet.addRow({ driver: d.name, ticket_count: d.ticket_count, ts_count: d.ts_count, ticket_pay: d.ticket_pay, ts_pay: d.ts_pay, total: d.ticket_pay + d.ts_pay })
  }
  ;['ticket_pay', 'ts_pay', 'total'].forEach(k => { byDriverSheet.getColumn(k).numFmt = '"$"#,##0.00' })

  // ── Sheet 3: Summary ────────────────────────────────────────────────────────
  const summarySheet = wb.addWorksheet('Summary')
  summarySheet.getColumn('A').width = 28
  summarySheet.getColumn('B').width = 18

  const grandTotal = Array.from(driverMap.values()).reduce((s, d) => s + d.ticket_pay + d.ts_pay, 0)
  const data = [
    ['Period', `${dateFrom} to ${dateTo}`],
    ['Generated', new Date().toLocaleDateString()],
    ['Total Drivers', driverMap.size],
    ['Total Load Lines', (tickets ?? []).length],
    ['Total Timesheet Lines', (timesheets ?? []).length],
    ['', ''],
    ['Grand Total Payroll', grandTotal],
  ]
  for (const [label, value] of data) {
    const row = summarySheet.addRow([label, value])
    if (label === 'Grand Total Payroll') {
      row.font = { bold: true, size: 13 }
      row.getCell(2).numFmt = '"$"#,##0.00'
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFd1fae5' } }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="payroll-${dateFrom}-${dateTo}.xlsx"`,
    },
  })
}
