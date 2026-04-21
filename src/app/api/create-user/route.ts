export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const { email, full_name, phone, role, truck_number, company_id } = await request.json()

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: 'TempPass123!',
    email_confirm: true,
  })

  if (error || !data.user) {
    return Response.json({ error: error?.message ?? 'Failed to create user' }, { status: 400 })
  }

  const { error: profileError } = await adminClient.from('users').insert({
    id: data.user.id,
    company_id,
    full_name,
    phone: phone || null,
    role,
    truck_number: truck_number || null,
  })

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 400 })
  }

  return Response.json({ userId: data.user.id })
}
