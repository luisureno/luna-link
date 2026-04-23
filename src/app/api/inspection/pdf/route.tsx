export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: '#1a1a1a', backgroundColor: '#fff' },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 3 },
  subtitle: { fontSize: 8, textAlign: 'center', color: '#555', marginBottom: 6 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: '#999', marginVertical: 5 },
  metaRow: { flexDirection: 'row', gap: 20, marginBottom: 3 },
  metaBlock: { flexDirection: 'row', gap: 4 },
  metaLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8 },
  metaValue: { fontSize: 8 },
  sectionHeader: { backgroundColor: '#e5e5e5', paddingHorizontal: 6, paddingVertical: 3, marginBottom: 5 },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, textTransform: 'uppercase' },
  itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  itemCell: { width: '33.33%', flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  checkbox: { width: 9, height: 9, borderWidth: 0.75, borderColor: '#555', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxFail: { backgroundColor: '#fee2e2', borderColor: '#dc2626' },
  checkboxPass: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  checkMark: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
  itemLabel: { fontSize: 7.5, flexShrink: 1 },
  itemLabelFail: { color: '#dc2626', fontFamily: 'Helvetica-Bold' },
  remarksSection: { marginTop: 4 },
  remarkItem: { marginBottom: 6 },
  remarkLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#dc2626', marginBottom: 1 },
  remarkNote: { fontSize: 8, color: '#444', paddingLeft: 8 },
  remarksBlankLine: { borderBottomWidth: 0.3, borderBottomColor: '#ccc', marginBottom: 4 },
  conditionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  conditionLabel: { fontSize: 8.5 },
  conditionLabelSelected: { fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
  sigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 8 },
  sigLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 2 },
  sigLine: { flex: 1, borderBottomWidth: 0.75, borderBottomColor: '#333', paddingBottom: 2 },
  sigName: { fontSize: 11, fontFamily: 'Helvetica-Oblique', paddingHorizontal: 4 },
  sigDate: { width: 60, textAlign: 'right', borderBottomWidth: 0.75, borderBottomColor: '#333', paddingBottom: 2, fontSize: 8.5 },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, borderTopWidth: 0.3, borderTopColor: '#ccc', paddingTop: 4, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#999' },
})

function CheckBox({ pass, selected }: { pass?: boolean; selected: boolean }) {
  return (
    <View style={[styles.checkbox, selected && pass === true ? styles.checkboxPass : selected && pass === false ? styles.checkboxFail : {}]}>
      {selected && pass === true && <Text style={[styles.checkMark, { color: '#16a34a' }]}>✓</Text>}
      {selected && pass === false && <Text style={[styles.checkMark, { color: '#dc2626' }]}>✗</Text>}
    </View>
  )
}

function SquareCheck({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked ? { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' } : {}]}>
      {checked && <Text style={[styles.checkMark, { color: '#fff' }]}>✓</Text>}
    </View>
  )
}

interface Item {
  id: string
  label: string
  passed: boolean | null
  note: string
  category: 'truck' | 'trailer'
}

interface PdfBody {
  driverName: string
  truckNumber: string | null
  companyName: string | null
  inspectedAt: string
  items: Item[]
  overallCondition: 'satisfactory' | 'defects_corrected' | 'no_correction_needed'
  signature: string
}

export async function POST(request: NextRequest) {
  const body: PdfBody = await request.json()

  const dateStr = new Date(body.inspectedAt).toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
  })

  const truckItems = body.items.filter(i => i.category === 'truck')
  const trailerItems = body.items.filter(i => i.category === 'trailer')
  const defectiveItems = body.items.filter(i => i.passed === false)

  const conditionLabel = {
    satisfactory: 'Condition of the above vehicle is satisfactory.',
    defects_corrected: 'Above Defects Corrected',
    no_correction_needed: 'Above Defects Need NOT Be Corrected For Safe Operation Of Vehicle',
  }

  const pdf = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>Driver's Vehicle Inspection Report</Text>
        <Text style={styles.subtitle}>Check ANY Defective Item and Give Details under "Remarks"</Text>
        <View style={styles.divider} />

        {/* Meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>DATE:</Text>
            <Text style={styles.metaValue}>{dateStr}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>TRUCK/TRACTOR NO.:</Text>
            <Text style={styles.metaValue}>{body.truckNumber ?? '—'}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>DRIVER:</Text>
            <Text style={styles.metaValue}>{body.driverName}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>COMPANY:</Text>
            <Text style={styles.metaValue}>{body.companyName ?? '—'}</Text>
          </View>
        </View>
        <View style={styles.divider} />

        {/* Truck items */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Truck / Tractor</Text>
        </View>
        <View style={styles.itemsGrid}>
          {truckItems.map(item => (
            <View key={item.id} style={styles.itemCell}>
              <CheckBox pass={item.passed ?? undefined} selected={item.passed !== null} />
              <Text style={[styles.itemLabel, item.passed === false ? styles.itemLabelFail : {}]}>{item.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.divider} />

        {/* Trailer items */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trailer(s)</Text>
        </View>
        <View style={styles.itemsGrid}>
          {trailerItems.map(item => (
            <View key={item.id} style={styles.itemCell}>
              <CheckBox pass={item.passed ?? undefined} selected={item.passed !== null} />
              <Text style={[styles.itemLabel, item.passed === false ? styles.itemLabelFail : {}]}>{item.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.divider} />

        {/* Remarks */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Remarks</Text>
        </View>
        <View style={styles.remarksSection}>
          {defectiveItems.length === 0 ? (
            <Text style={{ fontSize: 8, color: '#555', marginBottom: 6 }}>No defects found — all items passed.</Text>
          ) : (
            defectiveItems.map(item => (
              <View key={item.id} style={styles.remarkItem}>
                <Text style={styles.remarkLabel}>{item.label}:</Text>
                <Text style={styles.remarkNote}>{item.note || 'Issue flagged — no additional notes provided.'}</Text>
              </View>
            ))
          )}
          {[0, 1, 2].map(i => <View key={i} style={styles.remarksBlankLine} />)}
        </View>
        <View style={styles.divider} />

        {/* Condition */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Condition of Vehicle</Text>
        </View>
        {(['satisfactory', 'defects_corrected', 'no_correction_needed'] as const).map(key => (
          <View key={key} style={styles.conditionRow}>
            <SquareCheck checked={body.overallCondition === key} />
            <Text style={body.overallCondition === key ? styles.conditionLabelSelected : styles.conditionLabel}>
              {conditionLabel[key]}
            </Text>
          </View>
        ))}
        <View style={styles.divider} />

        {/* Signature */}
        <Text style={{ fontSize: 8, color: '#555', marginTop: 6, marginBottom: 4 }}>
          By signing below, the driver certifies that this vehicle has been inspected in accordance with applicable Federal Motor Carrier Safety Administration (FMCSA) requirements.
        </Text>
        <View style={styles.sigRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sigLabel}>Driver's Signature</Text>
            <View style={styles.sigLine}>
              <Text style={styles.sigName}>{body.signature}</Text>
            </View>
          </View>
          <View>
            <Text style={styles.sigLabel}>Date</Text>
            <View style={styles.sigDate}>
              <Text>{dateStr}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Fleetwise — Driver's Vehicle Inspection Report</Text>
          <Text style={styles.footerText}>{body.truckNumber ?? ''} · {dateStr}</Text>
        </View>
      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(pdf)

  // Upload to Supabase storage
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const logDate = new Date(body.inspectedAt).toISOString().split('T')[0]
  // driverName may be passed but we don't have driver_id here — caller must pass it
  const driverId = (body as any).driverId ?? 'unknown'
  const path = `inspections/${driverId}/${logDate}-inspection.pdf`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('fuel-receipts')
    .upload(path, buffer, { upsert: true, contentType: 'application/pdf' })

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('fuel-receipts').getPublicUrl(uploadData.path)

  return Response.json({ url: publicUrl })
}
