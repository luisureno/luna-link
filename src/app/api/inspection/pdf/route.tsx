export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// Mirror the checklist from the inspection page so the PDF shows full detail
const CATEGORY_CHECKLISTS: Record<string, string[]> = {
  engine: [
    'Fluid levels (oil, coolant, power steering, brake fluid)',
    'No leaks under hood or on ground',
    'Belts — no cracks or fraying',
    'Hoses — no wear, cracks, or loose clamps',
  ],
  steering_suspension: [
    'Steering box and hoses — secure, no leaks',
    'Steering linkage — no excessive play or wear',
    'Springs, shocks, or air bags — no cracks or damage',
  ],
  braking: [
    'Slack adjusters and pushrods — within spec (≤1" movement)',
    'Brake drums — no cracks; linings not worn through',
    'Air lines — no leaks, chafing, or improper connections',
  ],
  tires_wheels: [
    'Tire condition — no cuts, bulges, or exposed cord',
    'Tread depth — min 4/32" steer axle, 2/32" drive/trailer',
    'Lug nuts — all present and tight',
    'Valve stems — not missing or damaged',
  ],
  lighting: [
    'Front — headlights (high/low), turn signals, markers',
    'Side — clearance lights and reflectors',
    'Rear — brake lights, tail lights, reverse, turn signals',
  ],
  in_cab: [
    'Emergency kit — triangles, fire extinguisher, first aid',
    'Windshield clear (no obstructing cracks); mirrors adjusted',
    'Air brake test — proper pressure build-up, low-pressure warning works',
  ],
  trailer: [
    'Coupling (king pin) — fifth wheel jaws fully locked',
    'Brake connections (glad hands) — no leaks, properly connected',
    'Trailer lights — all running, brake, and turn signals working',
    'Tires and wheels — condition, tread, lug nuts',
    'Doors or tarps — latches secure, no damage',
    'Landing gear — fully raised, crank secured',
  ],
}

const styles = StyleSheet.create({
  page: { padding: 44, paddingBottom: 72, fontFamily: 'Helvetica', fontSize: 9, color: '#1a1a1a', backgroundColor: '#fff' },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },
  titleBlock: { alignItems: 'flex-end' },
  reportTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },
  reportSub: { fontSize: 8, color: '#888', marginTop: 2 },

  divider: { borderBottomWidth: 0.75, borderBottomColor: '#d0d0d0', marginBottom: 12 },
  thinDivider: { borderBottomWidth: 0.3, borderBottomColor: '#e0e0e0', marginBottom: 10 },

  // Meta grid
  metaGrid: { flexDirection: 'row', gap: 0, marginBottom: 16 },
  metaCell: { flex: 1 },
  metaLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { fontSize: 9.5, color: '#1a1a1a' },

  // Category section
  categoryBlock: { marginBottom: 12 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  categoryName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },
  badgePass: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#16a34a', backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeFail: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#dc2626', backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  checklistItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: 3 },
  bullet: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#c0c0c0', marginTop: 2.5, flexShrink: 0 },
  bulletFail: { backgroundColor: '#dc2626' },
  checklistText: { fontSize: 8, color: '#444', flex: 1 },

  noteBlock: { flexDirection: 'row', gap: 5, marginTop: 4, backgroundColor: '#fff7ed', padding: 5, borderRadius: 3, borderLeftWidth: 2, borderLeftColor: '#f97316' },
  noteLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#c2410c' },
  noteText: { fontSize: 7.5, color: '#7c2d12', flex: 1 },

  // Condition
  conditionSection: { marginTop: 4, marginBottom: 12 },
  conditionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  conditionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  checkbox: { width: 9, height: 9, borderWidth: 0.75, borderColor: '#555', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxFilled: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  checkMark: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#fff' },
  conditionLabel: { fontSize: 8.5, color: '#333' },
  conditionLabelBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },

  // Certification text
  certText: { fontSize: 7.5, color: '#666', marginBottom: 14, lineHeight: 1.4 },

  // Signature block — stacked, not side by side
  sigBlock: { marginBottom: 0 },
  sigField: { marginBottom: 12 },
  sigFieldLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  sigLine: { borderBottomWidth: 0.75, borderBottomColor: '#333', paddingBottom: 3 },
  sigText: { fontSize: 11, fontFamily: 'Helvetica-Oblique', color: '#1a1a1a' },
  sigPlain: { fontSize: 9, color: '#1a1a1a' },

  // Footer
  footer: { position: 'absolute', bottom: 28, left: 44, right: 44, borderTopWidth: 0.3, borderTopColor: '#ccc', paddingTop: 5, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#aaa' },
})

interface Item {
  id: string
  label: string
  passed: boolean | null
  note: string
  category: 'truck' | 'trailer'
}

interface PdfBody {
  driverName: string
  driverId?: string
  truckNumber: string | null
  companyName: string | null
  inspectedAt: string
  items: Item[]
  overallCondition: 'satisfactory' | 'defects_corrected' | 'no_correction_needed'
  signature: string
  vehicleType?: 'tractor_only' | 'tractor_trailer'
}

const conditionLabels = {
  satisfactory: 'Condition of vehicle is satisfactory.',
  defects_corrected: 'Above defects have been corrected.',
  no_correction_needed: 'Defects need NOT be corrected for safe operation of vehicle.',
}

export async function POST(request: NextRequest) {
  const body: PdfBody = await request.json()

  const dateStr = new Date(body.inspectedAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const shortDate = new Date(body.inspectedAt).toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
  })

  const pdf = (
    <Document>
      <Page size="LETTER" style={styles.page}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.brand}>Fleetwise</Text>
          <View style={styles.titleBlock}>
            <Text style={styles.reportTitle}>Pre-Trip Inspection Report</Text>
            <Text style={styles.reportSub}>FMCSA Driver Vehicle Inspection</Text>
          </View>
        </View>
        <View style={styles.divider} />

        {/* Meta */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{dateStr}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Driver</Text>
            <Text style={styles.metaValue}>{body.driverName}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Truck / Tractor No.</Text>
            <Text style={styles.metaValue}>{body.truckNumber ?? '—'}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Company</Text>
            <Text style={styles.metaValue}>{body.companyName ?? '—'}</Text>
          </View>
        </View>
        <View style={styles.divider} />

        {/* Categories */}
        {body.items.map(item => {
          const checklist = CATEGORY_CHECKLISTS[item.id] ?? []
          const passed = item.passed === true
          const failed = item.passed === false
          return (
            <View key={item.id} style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>{item.label}</Text>
                {passed && <Text style={styles.badgePass}>✓  PASSED</Text>}
                {failed && <Text style={styles.badgeFail}>✗  ISSUE REPORTED</Text>}
              </View>
              {checklist.map((line, i) => (
                <View key={i} style={styles.checklistItem}>
                  <View style={[styles.bullet, failed ? styles.bulletFail : {}]} />
                  <Text style={styles.checklistText}>{line}</Text>
                </View>
              ))}
              {failed && (
                <View style={styles.noteBlock}>
                  <Text style={styles.noteLabel}>Note: </Text>
                  <Text style={styles.noteText}>{item.note || 'Issue flagged — no additional notes provided.'}</Text>
                </View>
              )}
              <View style={styles.thinDivider} />
            </View>
          )
        })}

        {/* Condition */}
        <View style={styles.conditionSection}>
          <Text style={styles.conditionTitle}>Condition of Vehicle</Text>
          {(['satisfactory', 'defects_corrected', 'no_correction_needed'] as const).map(key => (
            <View key={key} style={styles.conditionRow}>
              <View style={[styles.checkbox, body.overallCondition === key ? styles.checkboxFilled : {}]}>
                {body.overallCondition === key && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={body.overallCondition === key ? styles.conditionLabelBold : styles.conditionLabel}>
                {conditionLabels[key]}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.divider} />

        {/* Certification */}
        <Text style={styles.certText}>
          By signing below, I certify that this vehicle has been inspected in accordance with applicable Federal Motor Carrier Safety Administration (FMCSA) requirements and to the best of my knowledge the vehicle is in the condition indicated above.
        </Text>

        {/* Signature — stacked fields */}
        <View style={styles.sigBlock}>
          <View style={styles.sigField}>
            <Text style={styles.sigFieldLabel}>Driver's Name</Text>
            <View style={styles.sigLine}>
              <Text style={styles.sigPlain}>{body.driverName}</Text>
            </View>
          </View>
          <View style={styles.sigField}>
            <Text style={styles.sigFieldLabel}>Driver's Signature</Text>
            <View style={styles.sigLine}>
              <Text style={styles.sigText}>{body.signature}</Text>
            </View>
          </View>
          <View style={[styles.sigField, { width: 180 }]}>
            <Text style={styles.sigFieldLabel}>Date</Text>
            <View style={styles.sigLine}>
              <Text style={styles.sigPlain}>{shortDate}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Fleetwise — Pre-Trip Inspection Report</Text>
          <Text style={styles.footerText}>
            {[body.truckNumber, body.driverName, shortDate].filter(Boolean).join(' · ')}
          </Text>
        </View>

      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(pdf)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const logDate = new Date(body.inspectedAt).toISOString().split('T')[0]
  const driverId = body.driverId ?? 'unknown'
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
