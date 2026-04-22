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
  const invoiceId = searchParams.get('id')
  if (!invoiceId) return new Response('Missing id', { status: 400 })

  const { data: inv } = await supabase
    .from('invoices')
    .select('*, clients(*), companies(*)')
    .eq('id', invoiceId)
    .single()

  if (!inv) return new Response('Invoice not found', { status: 404 })

  const invAny = inv as any
  const client = invAny.clients ?? {}
  const company = invAny.companies ?? {}

  const { data: tickets } = await supabase
    .from('load_tickets')
    .select('*, users(full_name), clients(name), job_sites(name)')
    .eq('company_id', invAny.company_id)
    .eq('client_id', invAny.client_id)
    .eq('status', 'invoiced')
    .eq('invoice_line_confirmed', true)
    .gte('submitted_at', `${invAny.date_from}T00:00:00`)
    .lte('submitted_at', `${invAny.date_to}T23:59:59`)
    .order('submitted_at')

  const { data: timesheets } = await supabase
    .from('daily_timesheets')
    .select('*, users(full_name), clients(name), job_sites(name)')
    .eq('company_id', invAny.company_id)
    .eq('client_id', invAny.client_id)
    .eq('status', 'invoiced')
    .gte('work_date', invAny.date_from)
    .lte('work_date', invAny.date_to)
    .order('work_date')

  const ticketsList = (tickets ?? []) as any[]
  const timesheetsList = (timesheets ?? []) as any[]

  const wb = new ExcelJS.Workbook()
  wb.creator = 'FleetWise'
  wb.created = new Date()

  // ── Sheet 1: Formatted Invoice ──────────────────────────────────────────────
  const s1 = wb.addWorksheet('Invoice', {
    pageSetup: { paperSize: 9, orientation: 'portrait', margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  })
  s1.getColumn('A').width = 6
  s1.getColumn('B').width = 28
  s1.getColumn('C').width = 16
  s1.getColumn('D').width = 12
  s1.getColumn('E').width = 14
  s1.getColumn('F').width = 16

  // Company header
  s1.mergeCells('B2:F2')
  const companyCell = s1.getCell('B2')
  companyCell.value = company.name ?? 'FleetWise Customer'
  companyCell.font = { bold: true, size: 20, color: { argb: 'FF1a1a1a' } }
  companyCell.alignment = { vertical: 'middle' }

  if (company.address) {
    s1.mergeCells('B3:F3')
    s1.getCell('B3').value = company.address
    s1.getCell('B3').font = { size: 10, color: { argb: 'FF6b7280' } }
  }
  if (company.phone) {
    s1.mergeCells('B4:F4')
    s1.getCell('B4').value = company.phone
    s1.getCell('B4').font = { size: 10, color: { argb: 'FF6b7280' } }
  }

  // INVOICE title + meta block
  s1.mergeCells('B6:F6')
  const titleCell = s1.getCell('B6')
  titleCell.value = 'INVOICE'
  titleCell.font = { bold: true, size: 28, color: { argb: 'FF1a1a1a' } }
  titleCell.alignment = { horizontal: 'right' }

  const metaStart = 8
  const metaRows: Array<[string, any]> = [
    ['Invoice #', invAny.invoice_number],
    ['Issued', new Date(invAny.created_at ?? Date.now()).toLocaleDateString()],
    ['Period', `${invAny.date_from} → ${invAny.date_to}`],
    ['Status', String(invAny.status ?? 'draft').toUpperCase()],
  ]
  metaRows.forEach(([label, val], i) => {
    const rowIdx = metaStart + i
    s1.getCell(`E${rowIdx}`).value = label
    s1.getCell(`E${rowIdx}`).font = { bold: true, size: 10, color: { argb: 'FF6b7280' } }
    s1.getCell(`E${rowIdx}`).alignment = { horizontal: 'right' }
    s1.getCell(`F${rowIdx}`).value = val
    s1.getCell(`F${rowIdx}`).font = { size: 11, color: { argb: 'FF1a1a1a' } }
  })

  // Bill To
  s1.getCell('B8').value = 'BILL TO'
  s1.getCell('B8').font = { bold: true, size: 10, color: { argb: 'FF6b7280' } }
  s1.getCell('B9').value = client.name ?? '—'
  s1.getCell('B9').font = { bold: true, size: 13 }
  if (client.contact_name) {
    s1.getCell('B10').value = client.contact_name
    s1.getCell('B10').font = { size: 10, color: { argb: 'FF4b5563' } }
  }
  if (client.address) {
    s1.getCell('B11').value = client.address
    s1.getCell('B11').font = { size: 10, color: { argb: 'FF4b5563' } }
  }
  if (client.contact_email) {
    s1.getCell('B12').value = client.contact_email
    s1.getCell('B12').font = { size: 10, color: { argb: 'FF4b5563' } }
  }

  // Line items header (row 15)
  const tableHeaderRow = 15
  const headers = ['Date', 'Description', 'Driver', 'Qty', 'Rate', 'Amount']
  headers.forEach((h, i) => {
    const cell = s1.getCell(tableHeaderRow, 2 + i) // B..G? no, B..F+1 since we have 6 columns
  })
  // Use columns B C D E F — we only have 5 display columns; collapse Qty+Rate visually
  s1.getCell(`B${tableHeaderRow}`).value = 'Date'
  s1.getCell(`C${tableHeaderRow}`).value = 'Description'
  s1.getCell(`D${tableHeaderRow}`).value = 'Driver'
  s1.getCell(`E${tableHeaderRow}`).value = 'Qty'
  s1.getCell(`F${tableHeaderRow}`).value = 'Amount'
  for (const col of ['B', 'C', 'D', 'E', 'F']) {
    const cell = s1.getCell(`${col}${tableHeaderRow}`)
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } }
    cell.alignment = { vertical: 'middle', horizontal: col === 'E' || col === 'F' ? 'right' : 'left' }
  }
  s1.getRow(tableHeaderRow).height = 22

  let rowIdx = tableHeaderRow + 1
  let subtotal = 0

  for (const t of ticketsList) {
    const amount = Number(t.client_charge_total ?? 0)
    subtotal += amount
    const qty =
      t.billing_type === 'per_ton'
        ? `${t.weight_tons ?? '?'} tons`
        : t.billing_type === 'hourly'
        ? `${t.hours_billed_client ?? t.hours_worked ?? '?'} hrs`
        : `${t.loads_count ?? 1} load${(t.loads_count ?? 1) === 1 ? '' : 's'}`
    const desc = [
      t.billing_type === 'per_ton'
        ? `${t.material_type ?? 'Material'} haul`
        : t.billing_type === 'hourly'
        ? 'Hourly service'
        : 'Load ticket',
      t.tag_number ? `Tag #${t.tag_number}` : null,
      t.job_sites?.name ?? null,
    ]
      .filter(Boolean)
      .join(' · ')
    s1.getCell(`B${rowIdx}`).value = t.submitted_at?.split('T')[0] ?? ''
    s1.getCell(`C${rowIdx}`).value = desc
    s1.getCell(`D${rowIdx}`).value = t.users?.full_name ?? '—'
    s1.getCell(`E${rowIdx}`).value = qty
    s1.getCell(`E${rowIdx}`).alignment = { horizontal: 'right' }
    s1.getCell(`F${rowIdx}`).value = amount
    s1.getCell(`F${rowIdx}`).numFmt = '"$"#,##0.00'
    s1.getCell(`F${rowIdx}`).alignment = { horizontal: 'right' }
    // zebra
    if ((rowIdx - tableHeaderRow) % 2 === 0) {
      for (const col of ['B', 'C', 'D', 'E', 'F']) {
        s1.getCell(`${col}${rowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      }
    }
    rowIdx++
  }
  for (const t of timesheetsList) {
    const amount = Number(t.client_charge_total ?? 0)
    subtotal += amount
    const hrs = t.dispatcher_adjusted_hours ?? t.hours_billed_client ?? t.hours_worked ?? 0
    s1.getCell(`B${rowIdx}`).value = t.work_date ?? ''
    s1.getCell(`C${rowIdx}`).value = ['Hourly service', t.job_sites?.name].filter(Boolean).join(' · ')
    s1.getCell(`D${rowIdx}`).value = t.users?.full_name ?? '—'
    s1.getCell(`E${rowIdx}`).value = `${hrs} hrs`
    s1.getCell(`E${rowIdx}`).alignment = { horizontal: 'right' }
    s1.getCell(`F${rowIdx}`).value = amount
    s1.getCell(`F${rowIdx}`).numFmt = '"$"#,##0.00'
    s1.getCell(`F${rowIdx}`).alignment = { horizontal: 'right' }
    if ((rowIdx - tableHeaderRow) % 2 === 0) {
      for (const col of ['B', 'C', 'D', 'E', 'F']) {
        s1.getCell(`${col}${rowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      }
    }
    rowIdx++
  }

  // Totals
  rowIdx += 1
  s1.getCell(`E${rowIdx}`).value = 'Subtotal'
  s1.getCell(`E${rowIdx}`).font = { size: 10, color: { argb: 'FF4b5563' } }
  s1.getCell(`E${rowIdx}`).alignment = { horizontal: 'right' }
  s1.getCell(`F${rowIdx}`).value = subtotal
  s1.getCell(`F${rowIdx}`).numFmt = '"$"#,##0.00'
  s1.getCell(`F${rowIdx}`).alignment = { horizontal: 'right' }

  rowIdx++
  s1.getCell(`E${rowIdx}`).value = 'TOTAL DUE'
  s1.getCell(`E${rowIdx}`).font = { bold: true, size: 13, color: { argb: 'FF1a1a1a' } }
  s1.getCell(`E${rowIdx}`).alignment = { horizontal: 'right' }
  s1.getCell(`F${rowIdx}`).value = subtotal
  s1.getCell(`F${rowIdx}`).numFmt = '"$"#,##0.00'
  s1.getCell(`F${rowIdx}`).font = { bold: true, size: 13 }
  s1.getCell(`F${rowIdx}`).alignment = { horizontal: 'right' }
  s1.getCell(`F${rowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } }
  s1.getRow(rowIdx).height = 24

  // Custom items
  const customItems: Array<{ label: string; amount: number }> = Array.isArray(invAny.custom_items) ? invAny.custom_items : []
  for (const ci of customItems) {
    const amount = Number(ci.amount ?? 0)
    s1.getCell(`B${rowIdx}`).value = ''
    s1.getCell(`C${rowIdx}`).value = ci.label ?? 'Custom item'
    s1.getCell(`D${rowIdx}`).value = ''
    s1.getCell(`E${rowIdx}`).value = '—'
    s1.getCell(`E${rowIdx}`).alignment = { horizontal: 'right' }
    s1.getCell(`F${rowIdx}`).value = amount
    s1.getCell(`F${rowIdx}`).numFmt = '"$"#,##0.00'
    s1.getCell(`F${rowIdx}`).alignment = { horizontal: 'right' }
    rowIdx++
  }

  // Route (origin → destination)
  if (invAny.origin || invAny.destination) {
    rowIdx += 1
    s1.getCell(`B${rowIdx}`).value = 'Route'
    s1.getCell(`B${rowIdx}`).font = { bold: true, size: 10, color: { argb: 'FF6b7280' } }
    s1.getCell(`C${rowIdx}`).value = [invAny.origin, invAny.destination].filter(Boolean).join(' → ')
    s1.mergeCells(`C${rowIdx}:F${rowIdx}`)
    rowIdx++
  }

  // Notes / footer
  if (invAny.notes) {
    rowIdx += 3
    s1.getCell(`B${rowIdx}`).value = 'Notes'
    s1.getCell(`B${rowIdx}`).font = { bold: true, size: 10, color: { argb: 'FF6b7280' } }
    rowIdx++
    s1.mergeCells(`B${rowIdx}:F${rowIdx}`)
    s1.getCell(`B${rowIdx}`).value = invAny.notes
    s1.getCell(`B${rowIdx}`).alignment = { wrapText: true }
  }

  // ── Sheet 2: Raw Load Tickets ───────────────────────────────────────────────
  const s2 = wb.addWorksheet('Load Tickets')
  const ticketCols = [
    { header: 'Submitted At', key: 'submitted_at', width: 20 },
    { header: 'Ticket ID', key: 'id', width: 18 },
    { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Client', key: 'client_name', width: 22 },
    { header: 'Job Site', key: 'job_site', width: 22 },
    { header: 'Billing Type', key: 'billing_type', width: 14 },
    { header: 'Submission Method', key: 'submission_method', width: 18 },
    { header: 'Tag #', key: 'tag_number', width: 14 },
    { header: 'Material', key: 'material_type', width: 16 },
    { header: 'Weight (tons)', key: 'weight_tons', width: 14 },
    { header: 'Hours Worked', key: 'hours_worked', width: 14 },
    { header: 'Hours Billed', key: 'hours_billed_client', width: 14 },
    { header: 'Hours Paid Driver', key: 'hours_paid_driver', width: 16 },
    { header: 'Client Rate', key: 'client_rate_amount', width: 14 },
    { header: 'Client Rate Unit', key: 'client_rate_unit', width: 14 },
    { header: 'Client Charge', key: 'client_charge_total', width: 16 },
    { header: 'Driver Pay/Load', key: 'driver_pay_per_load', width: 16 },
    { header: 'Driver Hourly Rate', key: 'driver_hourly_rate', width: 18 },
    { header: 'Driver Pay Total', key: 'driver_pay_total', width: 16 },
    { header: 'Adjusted Pay', key: 'dispatcher_adjusted_pay', width: 14 },
    { header: 'Adjustment Reason', key: 'dispatcher_adjustment_reason', width: 28 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Line Confirmed', key: 'invoice_line_confirmed', width: 14 },
    { header: 'Line Notes', key: 'invoice_line_notes', width: 28 },
    { header: 'Confirmed At', key: 'confirmed_at', width: 20 },
    { header: 'GPS Lat', key: 'latitude', width: 12 },
    { header: 'GPS Lng', key: 'longitude', width: 12 },
    { header: 'Notes', key: 'notes', width: 28 },
  ]
  s2.columns = ticketCols
  s2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  s2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } }
  s2.getRow(1).height = 20
  s2.views = [{ state: 'frozen', ySplit: 1 }]

  for (const t of ticketsList) {
    s2.addRow({
      submitted_at: t.submitted_at,
      id: t.id,
      driver: t.users?.full_name ?? '',
      client_name: t.clients?.name ?? '',
      job_site: t.job_sites?.name ?? '',
      billing_type: t.billing_type ?? '',
      submission_method: t.submission_method ?? '',
      tag_number: t.tag_number ?? '',
      material_type: t.material_type ?? '',
      weight_tons: t.weight_tons ?? '',
      hours_worked: t.hours_worked ?? '',
      hours_billed_client: t.hours_billed_client ?? '',
      hours_paid_driver: t.hours_paid_driver ?? '',
      client_rate_amount: t.client_rate_amount ?? '',
      client_rate_unit: t.client_rate_unit ?? '',
      client_charge_total: t.client_charge_total ?? '',
      driver_pay_per_load: t.driver_pay_per_load ?? '',
      driver_hourly_rate: t.driver_hourly_rate ?? '',
      driver_pay_total: t.driver_pay_total ?? '',
      dispatcher_adjusted_pay: t.dispatcher_adjusted_pay ?? '',
      dispatcher_adjustment_reason: t.dispatcher_adjustment_reason ?? '',
      status: t.status ?? '',
      invoice_line_confirmed: t.invoice_line_confirmed ? 'yes' : 'no',
      invoice_line_notes: t.invoice_line_notes ?? '',
      confirmed_at: t.confirmed_at ?? '',
      latitude: t.latitude ?? '',
      longitude: t.longitude ?? '',
      notes: t.notes ?? '',
    })
  }
  ;['client_rate_amount', 'client_charge_total', 'driver_pay_per_load', 'driver_hourly_rate', 'driver_pay_total', 'dispatcher_adjusted_pay'].forEach(k => {
    s2.getColumn(k).numFmt = '"$"#,##0.00'
  })

  // ── Sheet 3: Raw Timesheets ─────────────────────────────────────────────────
  const s3 = wb.addWorksheet('Timesheets')
  const timesheetCols = [
    { header: 'Work Date', key: 'work_date', width: 14 },
    { header: 'Timesheet ID', key: 'id', width: 18 },
    { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Client', key: 'client_name', width: 22 },
    { header: 'Job Site', key: 'job_site', width: 22 },
    { header: 'Arrived At', key: 'arrived_at', width: 20 },
    { header: 'Departed At', key: 'departed_at', width: 20 },
    { header: 'Hours Worked', key: 'hours_worked', width: 14 },
    { header: 'Hours Billed', key: 'hours_billed_client', width: 14 },
    { header: 'Hours Paid Driver', key: 'hours_paid_driver', width: 16 },
    { header: 'Client Rate/Hr', key: 'client_rate_per_hour', width: 14 },
    { header: 'Driver Rate/Hr', key: 'driver_hourly_rate', width: 14 },
    { header: 'Client Charge', key: 'client_charge_total', width: 16 },
    { header: 'Driver Pay', key: 'driver_pay_total', width: 14 },
    { header: 'Adjusted Hours', key: 'dispatcher_adjusted_hours', width: 16 },
    { header: 'Adjustment Reason', key: 'dispatcher_adjustment_reason', width: 28 },
    { header: 'Submission Method', key: 'submission_method', width: 18 },
    { header: 'Client Signer', key: 'client_signer_name', width: 20 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Confirmed At', key: 'confirmed_at', width: 20 },
    { header: 'Submitted At', key: 'submitted_at', width: 20 },
    { header: 'GPS Lat', key: 'gps_lat', width: 12 },
    { header: 'GPS Lng', key: 'gps_lng', width: 12 },
    { header: 'Notes', key: 'notes', width: 28 },
  ]
  s3.columns = timesheetCols
  s3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  s3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } }
  s3.getRow(1).height = 20
  s3.views = [{ state: 'frozen', ySplit: 1 }]

  for (const t of timesheetsList) {
    s3.addRow({
      work_date: t.work_date,
      id: t.id,
      driver: t.users?.full_name ?? '',
      client_name: t.clients?.name ?? '',
      job_site: t.job_sites?.name ?? '',
      arrived_at: t.arrived_at ?? '',
      departed_at: t.departed_at ?? '',
      hours_worked: t.hours_worked ?? '',
      hours_billed_client: t.hours_billed_client ?? '',
      hours_paid_driver: t.hours_paid_driver ?? '',
      client_rate_per_hour: t.client_rate_per_hour ?? '',
      driver_hourly_rate: t.driver_hourly_rate ?? '',
      client_charge_total: t.client_charge_total ?? '',
      driver_pay_total: t.driver_pay_total ?? '',
      dispatcher_adjusted_hours: t.dispatcher_adjusted_hours ?? '',
      dispatcher_adjustment_reason: t.dispatcher_adjustment_reason ?? '',
      submission_method: t.submission_method ?? '',
      client_signer_name: t.client_signer_name ?? '',
      status: t.status ?? '',
      confirmed_at: t.confirmed_at ?? '',
      submitted_at: t.submitted_at ?? '',
      gps_lat: t.gps_lat ?? '',
      gps_lng: t.gps_lng ?? '',
      notes: t.notes ?? '',
    })
  }
  ;['client_rate_per_hour', 'driver_hourly_rate', 'client_charge_total', 'driver_pay_total'].forEach(k => {
    s3.getColumn(k).numFmt = '"$"#,##0.00'
  })

  const buffer = await wb.xlsx.writeBuffer()

  const fileName = `${invAny.invoice_number ?? 'invoice'}.xlsx`
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
