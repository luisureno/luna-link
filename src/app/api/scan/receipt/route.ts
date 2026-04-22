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
      max_tokens: 512,
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
              text: `You are reading a fuel station or DEF (Diesel Exhaust Fluid) receipt from a truck driver.
Extract ALL visible fields and return ONLY valid JSON with no markdown, no backticks, no explanation:
{
  "gallons": "diesel fuel gallons as number or null",
  "price_per_gallon": "diesel price per gallon as number or null",
  "total_cost": "diesel total dollar amount as number or null",
  "def_gallons": "DEF gallons as number or null",
  "def_price_per_gallon": "DEF price per gallon as number or null",
  "def_total_cost": "DEF total dollar amount as number or null"
}

Rules:
- If this is a diesel-only receipt, set all def_* fields to null.
- If this is a DEF-only receipt, set gallons, price_per_gallon, and total_cost to null.
- total_cost should be the final dollar amount paid for diesel fuel specifically.
- If total is shown but gallons are missing, still capture the total.
- Only extract what is clearly visible. Never guess.`,
            },
          ],
        },
      ],
    })

    const text = (message.content[0] as { type: string; text: string }).text.trim()
    const extracted = JSON.parse(text)
    return Response.json({ extracted })
  } catch (err) {
    console.error('[scan/receipt]', err)
    return Response.json({ extracted: null, error: 'AI extraction failed' })
  }
}
