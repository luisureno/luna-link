import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EMAILS = [
  'owner@mesarock.com',
  'dispatch@mesarock.com',
  'driver1@mesarock.com',
  'driver2@mesarock.com',
  'driver3@mesarock.com',
]

async function reset() {
  console.log('Cleaning up old data...')

  // Delete auth users by email
  const { data: { users } } = await supabase.auth.admin.listUsers()
  for (const user of users) {
    if (EMAILS.includes(user.email ?? '')) {
      await supabase.auth.admin.deleteUser(user.id)
      console.log('Deleted auth user:', user.email)
    }
  }

  // Delete companies (cascades to users table via FK if set, otherwise clean manually)
  await supabase.from('daily_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('load_tickets').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('check_ins').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('dispatch_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('dispatches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('ticket_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('job_sites').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  console.log('Cleanup done.\n')
}

async function seed() {
  const { data: company } = await supabase.from('companies').insert({
    name: 'Mesa Rock Hauling',
    address: '1200 E Main St, Mesa, AZ 85203',
    phone: '(480) 555-0100',
  }).select().single()
  if (!company) throw new Error('Failed to create company')
  console.log('Company created:', company.id)
  const cid = company.id

  async function createUser(email: string, role: string, full_name: string, truck_number?: string) {
    const { data, error } = await supabase.auth.admin.createUser({ email, password: 'password123', email_confirm: true })
    if (error || !data.user) throw new Error(`Failed to create auth user ${email}: ${error?.message ?? 'unknown'}`)
    await supabase.from('users').insert({ id: data.user.id, company_id: cid, full_name, role, truck_number: truck_number ?? null, phone: null, is_active: true })
    console.log('Created:', email)
    return data.user.id
  }

  const ownerId = await createUser('owner@mesarock.com', 'owner', 'Mike Ramirez')
  const dispatcherId = await createUser('dispatch@mesarock.com', 'dispatcher', 'Sandra Torres')
  const driver1Id = await createUser('driver1@mesarock.com', 'driver', 'Carlos Vega', 'T-101')
  const driver2Id = await createUser('driver2@mesarock.com', 'driver', 'Derek Johnson', 'T-102')
  const driver3Id = await createUser('driver3@mesarock.com', 'driver', 'Maria Flores', 'T-103')

  const { data: client1 } = await supabase.from('clients').insert({ company_id: cid, name: 'Riverside Construction', contact_name: 'Bob Mitchell', contact_phone: '(480) 555-0201', contact_email: 'bob@riversideconstruction.com', address: '3400 W River Rd, Tempe, AZ 85281' }).select().single()
  const { data: client2 } = await supabase.from('clients').insert({ company_id: cid, name: 'City of Mesa Public Works', contact_name: 'Janet Hale', contact_phone: '(480) 555-0300', contact_email: 'jhale@mesaaz.gov', address: '55 N Center St, Mesa, AZ 85201' }).select().single()

  const { data: site1 } = await supabase.from('job_sites').insert({ company_id: cid, client_id: client1!.id, name: 'Riverside Site A', address: '3400 W River Rd, Tempe, AZ', latitude: 33.4255, longitude: -111.9400 }).select().single()
  const { data: site2 } = await supabase.from('job_sites').insert({ company_id: cid, client_id: client1!.id, name: 'Riverside Site B', address: '3600 W River Rd, Tempe, AZ', latitude: 33.4240, longitude: -111.9420 }).select().single()
  const { data: site3 } = await supabase.from('job_sites').insert({ company_id: cid, client_id: client2!.id, name: 'Mesa Downtown Fill', address: '100 N Center St, Mesa, AZ', latitude: 33.4152, longitude: -111.8315 }).select().single()

  const { data: template } = await supabase.from('ticket_templates').insert({
    company_id: cid,
    name: 'Standard Load Ticket',
    description: 'Default template for all hauls',
    fields: [
      { id: 'material_type', label: 'Material Type', type: 'dropdown', required: true, options: ['Dirt', 'Gravel', 'Asphalt', 'Debris', 'Sand'] },
      { id: 'num_loads', label: 'Number of Loads', type: 'number', required: true },
      { id: 'tonnage', label: 'Tonnage', type: 'number', required: false },
      { id: 'po_number', label: 'PO Number', type: 'text', required: false },
      { id: 'notes', label: 'Notes', type: 'text', required: false },
    ],
  }).select().single()

  const drivers = [driver1Id, driver2Id, driver3Id]
  for (let i = 4; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    const { data: dispatch } = await supabase.from('dispatches').insert({
      company_id: cid,
      dispatcher_id: dispatcherId,
      client_id: i % 2 === 0 ? client1!.id : client2!.id,
      job_site_id: i % 3 === 0 ? site1!.id : i % 3 === 1 ? site2!.id : site3!.id,
      ticket_template_id: template!.id,
      title: `Haul Run — Day ${5 - i}`,
      scheduled_date: dateStr,
      status: 'completed',
    }).select().single()

    const assignedDrivers = drivers.slice(0, 2 + (i % 2))
    for (const driverId of assignedDrivers) {
      await supabase.from('dispatch_assignments').insert({ dispatch_id: dispatch!.id, driver_id: driverId, status: 'completed', acknowledged_at: new Date(`${dateStr}T07:00:00`).toISOString() })

      for (const [locType, hour] of [['yard', 6], ['quarry', 7], ['job_site', 9], ['yard', 16]] as [string, number][]) {
        await supabase.from('check_ins').insert({ company_id: cid, driver_id: driverId, dispatch_id: dispatch!.id, location_type: locType, checked_in_at: new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00`).toISOString() })
      }

      const numLoads = 3 + (i % 3)
      for (let l = 0; l < numLoads; l++) {
        await supabase.from('load_tickets').insert({ company_id: cid, driver_id: driverId, dispatch_id: dispatch!.id, client_id: dispatch!.client_id, job_site_id: dispatch!.job_site_id, ticket_template_id: template!.id, form_data: { material_type: 'Gravel', num_loads: 1, tonnage: 22 + (l * 0.5), po_number: `PO-${1000 + l}` }, status: 'confirmed', submitted_at: new Date(`${dateStr}T${String(9 + l).padStart(2, '0')}:30:00`).toISOString(), confirmed_at: new Date(`${dateStr}T${String(10 + l).padStart(2, '0')}:00:00`).toISOString(), confirmed_by: dispatcherId })
      }

      await supabase.from('daily_logs').upsert({ company_id: cid, driver_id: driverId, log_date: dateStr, total_loads: numLoads, total_hours: 9.5, first_check_in: new Date(`${dateStr}T06:00:00`).toISOString(), last_check_in: new Date(`${dateStr}T16:00:00`).toISOString() }, { onConflict: 'driver_id,log_date' })
    }
    console.log(`Day ${5 - i} seeded`)
  }

  console.log('\nSeed complete!')
  console.log('  Owner:      owner@mesarock.com / password123')
  console.log('  Dispatcher: dispatch@mesarock.com / password123')
  console.log('  Driver 1:   driver1@mesarock.com / password123')
  console.log('  Driver 2:   driver2@mesarock.com / password123')
  console.log('  Driver 3:   driver3@mesarock.com / password123')
}

reset().then(seed).catch(console.error)
