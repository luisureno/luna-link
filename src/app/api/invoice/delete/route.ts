export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Load the invoice to get the filter criteria
  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .select('id, company_id, client_id, date_from, date_to')
    .eq('id', id)
    .single()

  if (invErr || !inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const { company_id, client_id, date_from, date_to } = inv

  // Reset load_tickets that were part of this invoice back to confirmed
  if (client_id && date_from && date_to) {
    await supabase
      .from('load_tickets')
      .update({
        status: 'confirmed',
        invoice_line_confirmed: false,
        invoice_line_confirmed_at: null,
        invoice_line_confirmed_by: null,
        invoice_line_notes: null,
      })
      .eq('company_id', company_id)
      .eq('client_id', client_id)
      .eq('invoice_line_confirmed', true)
      .gte('submitted_at', `${date_from}T00:00:00`)
      .lte('submitted_at', `${date_to}T23:59:59`)

    // Reset daily_timesheets too
    await supabase
      .from('daily_timesheets')
      .update({ status: 'confirmed' })
      .eq('company_id', company_id)
      .eq('client_id', client_id)
      .eq('status', 'invoiced')
      .gte('work_date', date_from)
      .lte('work_date', date_to)
  }

  // Delete the invoice
  const { error: delErr } = await supabase.from('invoices').delete().eq('id', id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
