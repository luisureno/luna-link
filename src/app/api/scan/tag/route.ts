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
              text: `You are reading a load ticket or tag from a dump trucking operation.
Extract the following fields and return ONLY valid JSON with no markdown, no backticks, no explanation:
{
  "tag_number": "string or null",
  "weight_tons": "number or null",
  "weight_lbs": "number or null",
  "material_type": "string or null",
  "date": "string in YYYY-MM-DD or null",
  "additional_text": "string or null"
}
If weight is in lbs convert to tons by dividing by 2000.
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
    console.error('[scan/tag]', err)
    return Response.json({ extracted: null, error: 'AI extraction failed' })
  }
}
