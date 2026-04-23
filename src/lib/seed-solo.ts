/**
 * Seeds the solo owner-operator demo account.
 * Run with: npx ts-node -r tsconfig-paths/register src/lib/seed-solo.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 * Safe to re-run — deletes existing demo data first.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEMO_EMAIL = 'demo.solo@fleetwisehq.com'
const DEMO_PASSWORD = 'Demo1234!'

async function seed() {
  console.log('Seeding solo demo account…')

  // Clean up existing demo user if present
  const { data: existing } = await supabase.auth.admin.listUsers()
  const existingUser = existing?.users.find(u => u.email === DEMO_EMAIL)
  if (existingUser) {
    await supabase.from('users').delete().eq('id', existingUser.id)
    await supabase.auth.admin.deleteUser(existingUser.id)
    console.log('Removed existing demo user')
  }

  // Company
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .insert({
      name: 'Desert Run Hauling',
      address: '4802 W McDowell Rd, Phoenix, AZ 85035',
      phone: '(602) 555-0180',
      account_type: 'solo',
      plan_id: 'solo',
      billing_status: 'trialing',
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single()
  if (companyErr || !company) throw new Error('Failed to create company: ' + companyErr?.message)
  console.log('Company created:', company.id)

  const cid = company.id

  // Subscription row
  await supabase.from('subscriptions').insert({
    company_id: cid,
    plan_id: 'solo',
    status: 'trialing',
    trial_started_at: new Date().toISOString(),
    trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  })

  // Auth user
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  })
  if (authErr || !authData.user) throw new Error('Failed to create auth user: ' + authErr?.message)
  const uid = authData.user.id

  // Profile — role owner, has a truck (owner-operator drives themselves)
  await supabase.from('users').insert({
    id: uid,
    company_id: cid,
    full_name: 'Carlos Vega',
    role: 'owner',
    truck_number: 'T-001',
    phone: '(602) 555-0181',
    is_active: true,
    pay_type: 'per_load',
    pay_rate: 57.50,
  })
  console.log('User created:', uid)

  // Client
  const { data: client } = await supabase
    .from('clients')
    .insert({ company_id: cid, name: 'Riverside Construction', contact_name: 'Bob Mitchell', contact_phone: '(480) 555-0201', contact_email: 'bob@riversideconstruction.com', address: '3400 W River Rd, Tempe, AZ 85281' })
    .select().single()
  console.log('Client created')

  // Sample data for past 5 days
  for (let i = 4; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    // Pre-trip inspection
    await supabase.from('pre_trip_inspections').insert({
      company_id: cid,
      driver_id: uid,
      truck_number: 'T-001',
      overall_status: 'passed',
      items: [
        { id: 'brakes', label: 'Brakes', passed: true },
        { id: 'lights', label: 'Lights', passed: true },
        { id: 'tires', label: 'Tires', passed: true },
        { id: 'mirrors', label: 'Mirrors', passed: true },
        { id: 'fluids', label: 'Fluids', passed: true },
      ],
      inspected_at: new Date(`${dateStr}T06:15:00`).toISOString(),
    })

    // 4–5 load tickets
    const numLoads = 4 + (i % 2)
    for (let l = 0; l < numLoads; l++) {
      await supabase.from('load_tickets').insert({
        company_id: cid,
        driver_id: uid,
        client_id: client!.id,
        form_data: { material_type: 'Gravel', weight_tons: (22 + l * 0.5).toFixed(1), origin: 'Desert Quarry', destination: 'Riverside Site A', tag_number: `TK-${4800 + i * 10 + l}` },
        tag_number: `TK-${4800 + i * 10 + l}`,
        weight_tons: 22 + l * 0.5,
        material_type: 'Gravel',
        status: 'confirmed',
        submitted_at: new Date(`${dateStr}T${String(8 + l).padStart(2, '0')}:${l % 2 === 0 ? '30' : '45'}:00`).toISOString(),
        confirmed_at: new Date(`${dateStr}T${String(9 + l).padStart(2, '0')}:00:00`).toISOString(),
        confirmed_by: uid,
      })
    }

    // Fuel log
    await supabase.from('fuel_logs').insert({
      company_id: cid,
      driver_id: uid,
      truck_number: 'T-001',
      gallons: 118.2,
      price_per_gallon: 3.899,
      total_cost: 460.87,
      logged_at: new Date(`${dateStr}T07:45:00`).toISOString(),
    })

    console.log(`Day ${5 - i} seeded`)
  }

  console.log('\nSolo demo seed complete!')
  console.log('  Email:    demo.solo@fleetwisehq.com')
  console.log('  Password: Demo1234!')
}

seed().catch(console.error)
