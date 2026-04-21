export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const client = new Anthropic()
  const formData = await request.formData()
  const imageFile = formData.get('image') as File | null
  if (!imageFile) return Response.json({ error: 'No image provided' }, { status: 400 })

  const bytes = await imageFile.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = (imageFile.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `You are reading a handwritten or printed paper invoice or load ticket from a dump trucking operation.
Extract ALL visible fields and return ONLY valid JSON with no markdown, no backticks, no explanation:
{
  "date": "date as string in YYYY-MM-DD or null",
  "tag_number": "tag, ticket, or invoice number as string or null",
  "client_name": "client or company name as string or null",
  "job_site": "job site, delivery location, or pit name as string or null",
  "material_type": "material or commodity (e.g. Concrete Sand, #57 Stone) as string or null",
  "weight_tons": "net weight in tons as number or null",
  "weight_lbs": "net weight in pounds as number or null",
  "gross_weight_lbs": "gross weight in pounds as number or null",
  "tare_weight_lbs": "tare weight in pounds as number or null",
  "loads_completed": "number of loads as number or null",
  "hours_worked": "hours worked as number or null",
  "truck_number": "truck or vehicle number as string or null",
  "trailer_number": "trailer number as string or null",
  "driver_name": "driver name as string or null",
  "po_number": "purchase order or PO number as string or null",
  "rate_amount": "rate shown (e.g. $12.50/ton) as string or null",
  "total_amount": "total dollar amount as string or null",
  "notes": "notes or comments as string or null",
  "additional_text": "any remaining readable text not captured above as string or null"
}
Read every single line. Extract everything clearly visible. Never guess. Return null for fields not present.`,
            },
          ],
        },
      ],
    })

    const text = (message.content[0] as { type: string; text: string }).text.trim()
    const extracted = JSON.parse(text)
    return Response.json({ extracted })
  } catch (err) {
    console.error('[scan/invoice]', err)
    return Response.json({ extracted: null, error: 'AI extraction failed' })
  }
}
