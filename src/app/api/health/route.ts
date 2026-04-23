export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY

  const checks: Record<string, string> = {
    SUPABASE_URL: url ? `set (${url.slice(0, 30)}…)` : 'MISSING',
    SUPABASE_ANON_KEY: anon ? `set (${anon.slice(0, 12)}…)` : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: service ? `set (${service.slice(0, 12)}…)` : 'MISSING',
  }

  // Try a real query with the anon key
  let dbPing = 'not tested'
  if (url && anon) {
    try {
      const supabase = createClient(url, anon)
      const start = Date.now()
      const { error } = await supabase.from('companies').select('id').limit(1)
      dbPing = error ? `error: ${error.message}` : `ok (${Date.now() - start}ms)`
    } catch (e: any) {
      dbPing = `exception: ${e?.message}`
    }
  }

  return NextResponse.json({ checks, dbPing })
}
