import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  if (!(await isAdmin(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await adminClient
    .from('company_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ requests: data })
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdmin(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status } = await request.json()
  const { error } = await adminClient
    .from('company_requests')
    .update({ status })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
