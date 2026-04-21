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
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
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
              text: `You are reading a fuel or DEF (Diesel Exhaust Fluid) station receipt.
Extract the following fields and return ONLY valid JSON with no markdown, no backticks, no explanation:
{
  "gallons": "diesel fuel gallons as number or null",
  "price_per_gallon": "diesel fuel price per gallon as number or null",
  "def_gallons": "DEF gallons as number or null",
  "def_price_per_gallon": "DEF price per gallon as number or null"
}
If this is a DEF-only receipt, set gallons and price_per_gallon to null.
If this is a diesel-only receipt, set def_gallons and def_price_per_gallon to null.
Only extract what is clearly visible. Never guess.`,
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
