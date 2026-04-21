export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const { token, email, password, full_name, phone, truck_number } = await request.json()

  if (!token || !email || !password || !full_name) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: company } = await adminClient
    .from('companies')
    .select('id, name')
    .eq('invite_token', token)
    .single()

  if (!company) {
    return Response.json({ error: 'Invalid invite link' }, { status: 404 })
  }

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return Response.json({ error: authError?.message ?? 'Failed to create account' }, { status: 400 })
  }

  const { error: profileError } = await adminClient.from('users').insert({
    id: authData.user.id,
    company_id: company.id,
    full_name,
    phone: phone || null,
    role: 'driver',
    truck_number: truck_number || null,
    is_active: true,
  })

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return Response.json({ error: profileError.message }, { status: 400 })
  }

  return Response.json({ ok: true, company_name: company.name })
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 })

  const { data: company } = await adminClient
    .from('companies')
    .select('name')
    .eq('invite_token', token)
    .single()

  if (!company) return Response.json({ error: 'Invalid invite link' }, { status: 404 })

  return Response.json({ company_name: company.name })
}
