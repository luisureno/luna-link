import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function generateTempPassword() {
  return (
    Math.random().toString(36).slice(2, 8) +
    Math.random().toString(36).slice(2, 8).toUpperCase() +
    '!'
  )
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    company_name,
    company_address,
    company_phone,
    owner_full_name,
    owner_email,
    owner_phone,
    request_id, // optional — mark request as onboarded
  } = body

  if (!company_name || !owner_full_name || !owner_email) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 1. Create company
  const { data: company, error: companyError } = await adminClient
    .from('companies')
    .insert({
      name: company_name,
      address: company_address || null,
      phone: company_phone || null,
    })
    .select('id, invite_token')
    .single()

  if (companyError || !company) {
    return Response.json({ error: `Company: ${companyError?.message}` }, { status: 400 })
  }

  // 2. Create owner auth user
  const tempPassword = generateTempPassword()
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: owner_email,
    password: tempPassword,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    // Roll back company
    await adminClient.from('companies').delete().eq('id', company.id)
    return Response.json({ error: `Auth: ${authError?.message ?? 'unknown'}` }, { status: 400 })
  }

  // 3. Create owner profile
  const { error: profileError } = await adminClient.from('users').insert({
    id: authData.user.id,
    company_id: company.id,
    full_name: owner_full_name,
    phone: owner_phone || null,
    role: 'owner',
    is_active: true,
  })

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authData.user.id)
    await adminClient.from('companies').delete().eq('id', company.id)
    return Response.json({ error: `Profile: ${profileError.message}` }, { status: 400 })
  }

  // 4. Mark request onboarded if linked
  if (request_id) {
    await adminClient.from('company_requests').update({ status: 'onboarded' }).eq('id', request_id)
  }

  return Response.json({
    ok: true,
    company_id: company.id,
    owner_email,
    temp_password: tempPassword,
    invite_token: company.invite_token,
  })
}
