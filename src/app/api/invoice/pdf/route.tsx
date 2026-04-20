import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  logo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },
  invoiceTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#1a1a1a', textAlign: 'right' },
  invoiceNum: { fontSize: 10, color: '#666', textAlign: 'right', marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  row: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5' },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#666' },
  td: { fontSize: 9, color: '#333' },
  col1: { width: '12%' },
  col2: { width: '20%' },
  col3: { width: '30%' },
  col4: { width: '18%' },
  col5: { width: '20%', textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 8 },
  totalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  totalValue: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#1a4fff' },
  watermark: { position: 'absolute', top: 240, left: 80, fontSize: 72, color: '#f0f0f0', fontFamily: 'Helvetica-Bold', transform: 'rotate(-35deg)', opacity: 0.15 },
  meta: { flexDirection: 'row', gap: 40, marginBottom: 24 },
  metaBlock: { flex: 1 },
  metaLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#999', marginBottom: 3 },
  metaValue: { fontSize: 10 },
})

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

  const isDraft = (inv as any).status === 'draft'
  const client = (inv as any).clients
  const company = (inv as any).companies
  const lines = [
    ...(tickets ?? []).map((t: any) => ({
      date: t.submitted_at?.split('T')[0] ?? '',
      driver: t.users?.full_name ?? '—',
      desc: t.billing_type === 'per_ton' ? `${t.weight_tons ?? '?'} tons${t.tag_number ? ` · Tag #${t.tag_number}` : ''}` : `${t.loads_count ?? 1} load(s)`,
      type: 'Load',
      amount: Number(t.client_charge_total ?? 0),
    })),
    ...(timesheets ?? []).map((t: any) => ({
      date: t.work_date ?? '',
      driver: t.users?.full_name ?? '—',
      desc: `${t.dispatcher_adjusted_hours ?? t.hours_billed_client ?? '?'}h on site`,
      type: 'Hourly',
      amount: Number(t.client_charge_total ?? 0),
    })),
  ]

  const total = lines.reduce((s, l) => s + l.amount, 0)

  const buffer = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        {isDraft && <Text style={styles.watermark}>DRAFT</Text>}

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>{company?.name ?? 'HaulProof'}</Text>
            {company?.address && <Text style={{ fontSize: 9, color: '#666', marginTop: 4 }}>{company.address}</Text>}
            {company?.phone && <Text style={{ fontSize: 9, color: '#666' }}>{company.phone}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNum}>{(inv as any).invoice_number}</Text>
          </View>
        </View>

        {/* Bill to + dates */}
        <View style={styles.meta}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Bill To</Text>
            <Text style={styles.metaValue}>{client?.name ?? '—'}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Period</Text>
            <Text style={styles.metaValue}>{(inv as any).date_from} to {(inv as any).date_to}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{(inv as any).created_at?.split('T')[0]}</Text>
          </View>
        </View>

        {/* Lines table */}
        <View style={styles.section}>
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 6 }]}>
            <Text style={[styles.th, styles.col1]}>Date</Text>
            <Text style={[styles.th, styles.col2]}>Driver</Text>
            <Text style={[styles.th, styles.col3]}>Description</Text>
            <Text style={[styles.th, styles.col4]}>Type</Text>
            <Text style={[styles.th, styles.col5]}>Amount</Text>
          </View>
          {lines.map((l, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.td, styles.col1]}>{l.date}</Text>
              <Text style={[styles.td, styles.col2]}>{l.driver}</Text>
              <Text style={[styles.td, styles.col3]}>{l.desc}</Text>
              <Text style={[styles.td, styles.col4]}>{l.type}</Text>
              <Text style={[styles.td, styles.col5]}>${l.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Due:</Text>
          <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
        </View>
      </Page>
    </Document>
  )

  return new Response(new Uint8Array(buffer as Buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${(inv as any).invoice_number}.pdf"`,
    },
  })
}
