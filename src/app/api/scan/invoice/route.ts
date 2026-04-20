import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
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
              text: `You are reading a handwritten or printed paper invoice from a trucking operation.
Extract the following fields and return ONLY valid JSON with no markdown, no backticks, no explanation:
{
  "date": "string in YYYY-MM-DD or null",
  "job_site": "string or null",
  "client_name": "string or null",
  "hours_worked": "number or null",
  "loads_completed": "number or null",
  "material_type": "string or null",
  "tag_number": "string or null",
  "weight_tons": "number or null",
  "notes": "string or null",
  "additional_text": "string or null"
}
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
    console.error('[scan/invoice]', err)
    return Response.json({ extracted: null, error: 'AI extraction failed' })
  }
}
