export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import { SOLO_DEMO_EMAIL, SOLO_DEMO_PASSWORD } from '@/lib/demo'

const CHECKLIST_ITEMS = [
  { id: 'brakes', label: 'Brakes', passed: true, note: '', photo_url: null },
  { id: 'lights', label: 'Lights', passed: true, note: '', photo_url: null },
  { id: 'tires', label: 'Tires', passed: true, note: '', photo_url: null },
  { id: 'mirrors', label: 'Mirrors', passed: true, note: '', photo_url: null },
  { id: 'horn', label: 'Horn', passed: true, note: '', photo_url: null },
  { id: 'wipers', label: 'Wipers', passed: true, note: '', photo_url: null },
  { id: 'fluid_levels', label: 'Fluid Levels', passed: true, note: '', photo_url: null },
]

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function dateStrAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function mmddyyyy(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${m}/${d}/${y}`
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const log: string[] = []

  // ── 1. Find or create the solo demo auth user ─────────────────────────────
  let authUserId: string

  const { data: existingUsers } = await admin.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find(u => u.email === SOLO_DEMO_EMAIL)

  if (existingUser) {
    authUserId = existingUser.id
    // Reset password in case it drifted
    await admin.auth.admin.updateUserById(authUserId, { password: SOLO_DEMO_PASSWORD })
    log.push(`Reusing auth user ${authUserId}`)

    // Wipe existing demo data so we start fresh
    const { data: profile } = await admin.from('users').select('company_id').eq('id', authUserId).single()
    if (profile?.company_id) {
      const cid = profile.company_id
      await Promise.all([
        admin.from('load_tickets').delete().eq('company_id', cid),
        admin.from('fuel_logs').delete().eq('company_id', cid),
        admin.from('pre_trip_inspections').delete().eq('company_id', cid),
        admin.from('daily_logs').delete().eq('company_id', cid),
        admin.from('invoices').delete().eq('company_id', cid),
        admin.from('clients').delete().eq('company_id', cid),
      ])
      log.push(`Wiped existing demo data for company ${cid}`)
    }
  } else {
    const { data: newAuth, error: authErr } = await admin.auth.admin.createUser({
      email: SOLO_DEMO_EMAIL,
      password: SOLO_DEMO_PASSWORD,
      email_confirm: true,
    })
    if (authErr || !newAuth.user) {
      return Response.json({ error: `Auth create failed: ${authErr?.message}` }, { status: 500 })
    }
    authUserId = newAuth.user.id
    log.push(`Created auth user ${authUserId}`)
  }

  // ── 2. Ensure company exists ──────────────────────────────────────────────
  const { data: existingProfile } = await admin.from('users').select('company_id').eq('id', authUserId).single()
  let companyId: string

  if (existingProfile?.company_id) {
    companyId = existingProfile.company_id
    await admin.from('companies').update({
      name: 'Desert Run Hauling',
      account_type: 'solo',
      plan_id: 'solo',
      billing_status: 'active',
    }).eq('id', companyId)
    log.push(`Reusing company ${companyId}`)
  } else {
    const { data: company, error: compErr } = await admin.from('companies').insert({
      name: 'Desert Run Hauling',
      account_type: 'solo',
      plan_id: 'solo',
      billing_status: 'active',
    }).select('id').single()
    if (compErr || !company) {
      return Response.json({ error: `Company create failed: ${compErr?.message}` }, { status: 500 })
    }
    companyId = company.id
    log.push(`Created company ${companyId}`)

    // Create or update user profile
    const { error: profileErr } = await admin.from('users').upsert({
      id: authUserId,
      company_id: companyId,
      full_name: 'Carlos Mendez',
      phone: '(602) 555-0182',
      role: 'owner',
      truck_number: 'T-CDM',
      is_active: true,
      pay_type: 'per_load',
      pay_rate: 57.50,
    })
    if (profileErr) {
      return Response.json({ error: `Profile upsert failed: ${profileErr.message}` }, { status: 500 })
    }
  }

  // Update profile fields regardless
  await admin.from('users').update({
    full_name: 'Carlos Mendez',
    truck_number: 'T-CDM',
    pay_type: 'per_load',
    pay_rate: 57.50,
  }).eq('id', authUserId)

  // ── 3. Create client ──────────────────────────────────────────────────────
  const { data: client, error: clientErr } = await admin.from('clients').insert({
    company_id: companyId,
    name: 'Phoenix Sand & Rock',
    contact_name: 'Dave Harmon',
    contact_phone: '(602) 555-0144',
    contact_email: 'dispatch@phoenixsandrock.com',
    address: '4820 W McDowell Rd, Phoenix, AZ 85035',
  }).select('id').single()
  if (clientErr || !client) {
    return Response.json({ error: `Client create failed: ${clientErr?.message}` }, { status: 500 })
  }
  const clientId = client.id
  log.push(`Created client ${clientId}`)

  // ── 4. Seed load tickets ──────────────────────────────────────────────────
  const ticketSeeds = [
    { daysBack: 5, tag: 'TK-4801', qtag: 'QT-1231', tons: 23.1, status: 'invoiced' as const, confirmed: true },
    { daysBack: 4, tag: 'TK-4807', qtag: 'QT-1235', tons: 24.5, status: 'invoiced' as const, confirmed: true },
    { daysBack: 3, tag: 'TK-4814', qtag: 'QT-1239', tons: 22.8, status: 'confirmed' as const, confirmed: false },
    { daysBack: 2, tag: 'TK-4821', qtag: 'QT-1244', tons: 25.2, status: 'confirmed' as const, confirmed: false },
    { daysBack: 2, tag: 'TK-4822', qtag: 'QT-1245', tons: 23.7, status: 'confirmed' as const, confirmed: false },
    { daysBack: 1, tag: 'TK-4829', qtag: 'QT-1248', tons: 24.1, status: 'submitted' as const, confirmed: false },
    { daysBack: 0, tag: 'TK-4835', qtag: 'QT-1251', tons: 22.4, status: 'submitted' as const, confirmed: false },
  ]

  const ticketInserts = ticketSeeds.map(t => {
    const dateStr = dateStrAgo(t.daysBack)
    return {
      company_id: companyId,
      driver_id: authUserId,
      client_id: clientId,
      status: t.status,
      billing_type: 'per_load',
      submission_method: 'tag_scan',
      tag_number: t.tag,
      weight_tons: t.tons,
      material_type: 'Crushed Granite 3/4"',
      loads_count: 1,
      client_rate_amount: 57.50,
      client_charge_total: 57.50,
      driver_pay_total: 57.50,
      invoice_line_confirmed: t.confirmed,
      submitted_at: daysAgo(t.daysBack),
      form_data: {
        ticket_date: mmddyyyy(dateStr),
        tag_number: t.tag,
        quarry_tag_number: t.qtag,
        client_name: 'Phoenix Sand & Rock',
        origin: 'Vulture Peak Quarry',
        destination: 'Phoenix Convention Center Site',
        material_type: 'Crushed Granite 3/4"',
        weight_tons: String(t.tons),
        gross_weight_lbs: String(Math.round(t.tons * 2000 + 4100)),
        tare_weight_lbs: '4100',
        loads_count: '1',
        truck_number: 'T-CDM',
        driver_name: 'Carlos Mendez',
        rate_amount: '57.50',
        total_amount: '57.50',
      },
    }
  })

  const { error: ticketErr } = await admin.from('load_tickets').insert(ticketInserts)
  if (ticketErr) {
    return Response.json({ error: `Tickets insert failed: ${ticketErr.message}` }, { status: 500 })
  }
  log.push(`Seeded ${ticketInserts.length} load tickets`)

  // ── 5. Seed fuel logs ─────────────────────────────────────────────────────
  const fuelSeeds = [
    { daysBack: 1, gallons: 118.232, ppg: 3.899, total: 461.27 },
    { daysBack: 3, gallons: 94.165, ppg: 3.879, total: 365.36 },
    { daysBack: 6, gallons: 102.441, ppg: 3.869, total: 396.34 },
  ]

  const { error: fuelErr } = await admin.from('fuel_logs').insert(
    fuelSeeds.map(f => ({
      company_id: companyId,
      driver_id: authUserId,
      gallons: f.gallons,
      price_per_gallon: f.ppg,
      receipt_url: null,
      logged_at: daysAgo(f.daysBack),
    }))
  )
  if (fuelErr) {
    return Response.json({ error: `Fuel logs failed: ${fuelErr.message}` }, { status: 500 })
  }
  log.push('Seeded 3 fuel logs')

  // ── 6. Pre-trip inspection (today, passed) ────────────────────────────────
  const today = dateStrAgo(0)
  const { data: inspection, error: inspErr } = await admin.from('pre_trip_inspections').insert({
    company_id: companyId,
    driver_id: authUserId,
    truck_number: 'T-CDM',
    items: CHECKLIST_ITEMS,
    overall_status: 'passed',
    inspected_at: new Date().toISOString(),
  }).select('id').single()
  if (inspErr) {
    return Response.json({ error: `Inspection failed: ${inspErr.message}` }, { status: 500 })
  }

  await admin.from('daily_logs').upsert({
    company_id: companyId,
    driver_id: authUserId,
    log_date: today,
    pre_trip_status: 'passed',
    pre_trip_inspection_id: inspection?.id ?? null,
  }, { onConflict: 'driver_id,log_date' })
  log.push('Seeded pre-trip inspection')

  // ── 7. Invoice (sent, for the 2 invoiced tickets) ────────────────────────
  const { error: invErr } = await admin.from('invoices').insert({
    company_id: companyId,
    client_id: clientId,
    invoice_number: 'INV-1000',
    invoice_type: 'client_invoice',
    status: 'sent',
    total_amount: 115.00,
    total_loads: 2,
    lines_total: 2,
    lines_confirmed: 2,
    date_from: dateStrAgo(6),
    date_to: dateStrAgo(4),
    client_address: '4820 W McDowell Rd, Phoenix, AZ 85035',
    custom_items: [],
  })
  if (invErr) {
    return Response.json({ error: `Invoice failed: ${invErr.message}` }, { status: 500 })
  }
  log.push('Seeded 1 invoice (sent, $115.00)')

  return Response.json({
    ok: true,
    message: 'Solo demo seeded successfully',
    email: SOLO_DEMO_EMAIL,
    password: SOLO_DEMO_PASSWORD,
    log,
  })
}
