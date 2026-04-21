export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 18, marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#666', marginBottom: 24 },
  driverBlock: { marginBottom: 20, breakInside: 'avoid' },
  driverName: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  col1: { width: '15%', fontSize: 9 },
  col2: { width: '45%', fontSize: 9 },
  col3: { width: '20%', fontSize: 9 },
  col4: { width: '20%', fontSize: 9, textAlign: 'right' },
  th: { fontFamily: 'Helvetica-Bold', color: '#666', fontSize: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  totalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginRight: 12 },
  totalValue: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#1a4fff' },
  grandTotal: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#ccc' },
})

export async function GET(request: NextRequest) {
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

  // Group by driver
  const map = new Map<string, { name: string; lines: any[]; total: number }>()

  for (const t of tickets ?? []) {
    const r = t as any
    const uid = r.users?.id ?? 'unknown'
    if (!map.has(uid)) map.set(uid, { name: r.users?.full_name ?? '—', lines: [], total: 0 })
    const pay = Number(r.dispatcher_adjusted_pay ?? r.driver_pay_total ?? 0)
    map.get(uid)!.lines.push({ date: r.submitted_at?.split('T')[0] ?? '', desc: r.billing_type === 'per_ton' ? `${r.weight_tons} tons` : `${r.loads_count} loads`, type: 'Load', pay })
    map.get(uid)!.total += pay
  }
  for (const t of timesheets ?? []) {
    const r = t as any
    const uid = r.users?.id ?? 'unknown'
    if (!map.has(uid)) map.set(uid, { name: r.users?.full_name ?? '—', lines: [], total: 0 })
    const pay = Number(r.driver_pay_total ?? 0)
    map.get(uid)!.lines.push({ date: r.work_date ?? '', desc: `${r.dispatcher_adjusted_hours ?? r.hours_paid_driver ?? '?'}h`, type: 'Hourly', pay })
    map.get(uid)!.total += pay
  }

  const drivers = Array.from(map.values())
  const grandTotal = drivers.reduce((s, d) => s + d.total, 0)

  const buffer = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Driver Payroll Summary</Text>
        <Text style={styles.subtitle}>{dateFrom} to {dateTo} · Generated {new Date().toLocaleDateString()}</Text>

        {drivers.map((driver, di) => (
          <View key={di} style={styles.driverBlock}>
            <Text style={styles.driverName}>{driver.name}</Text>
            <View style={[styles.row]}>
              <Text style={[styles.th, styles.col1]}>Date</Text>
              <Text style={[styles.th, styles.col2]}>Description</Text>
              <Text style={[styles.th, styles.col3]}>Type</Text>
              <Text style={[styles.th, styles.col4]}>Pay</Text>
            </View>
            {driver.lines.map((l, li) => (
              <View key={li} style={styles.row}>
                <Text style={styles.col1}>{l.date}</Text>
                <Text style={styles.col2}>{l.desc}</Text>
                <Text style={styles.col3}>{l.type}</Text>
                <Text style={styles.col4}>${l.pay.toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>${driver.total.toFixed(2)}</Text>
            </View>
          </View>
        ))}

        <View style={styles.grandTotal}>
          <Text style={{ ...styles.totalLabel, fontSize: 14 }}>Grand Total:</Text>
          <Text style={{ ...styles.totalValue, fontSize: 16 }}>${grandTotal.toFixed(2)}</Text>
        </View>
      </Page>
    </Document>
  )

  return new Response(new Uint8Array(buffer as Buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="payroll-${dateFrom}-${dateTo}.pdf"`,
    },
  })
}
