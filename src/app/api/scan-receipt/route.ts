import OpenAI from 'openai'
import { NextRequest } from 'next/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('image') as File | null
  if (!file) return Response.json({ error: 'No image provided' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mimeType = file.type || 'image/jpeg'

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are reading a fuel/gas station receipt. Extract:
- gallons: total gallons pumped (decimal number)
- price_per_gallon: price per gallon in dollars (decimal number)

Return ONLY valid JSON like: {"gallons": 12.345, "price_per_gallon": 3.459}
If you cannot confidently read a value, omit it from the JSON.`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
          },
        ],
      },
    ],
    max_tokens: 100,
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  let extracted: { gallons?: number; price_per_gallon?: number } = {}
  try {
    extracted = JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) extracted = JSON.parse(match[0])
  }

  return Response.json({ extracted })
}
