export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const { company_name, contact_name, email, phone, fleet_size, notes } = await request.json()

  if (!company_name || !contact_name || !email) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { error } = await adminClient.from('company_requests').insert({
    company_name,
    contact_name,
    email,
    phone: phone || null,
    fleet_size: fleet_size || null,
    notes: notes || null,
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 400 })
  }

  return Response.json({ ok: true })
}
