import OpenAI from 'openai'
import { NextRequest } from 'next/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('image') as File | null
  const fieldsJson = formData.get('fields') as string | null

  if (!file) return Response.json({ error: 'No image provided' }, { status: 400 })

  const fields: { id: string; label: string; type: string; options?: string[] }[] = fieldsJson
    ? JSON.parse(fieldsJson)
    : []

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mimeType = file.type || 'image/jpeg'

  const fieldDescriptions = fields
    .filter(f => f.type !== 'photo')
    .map(f => {
      const opts = f.options?.length ? ` (options: ${f.options.join(', ')})` : ''
      return `- "${f.id}": ${f.label}${opts}`
    })
    .join('\n')

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are analyzing a haul/load ticket or invoice photo for a trucking company.
Extract the following fields from the image and return a JSON object.
Only include fields you can confidently read. Use null for fields you cannot find.
Return ONLY valid JSON, no markdown, no explanation.

Fields to extract:
${fieldDescriptions}

Rules:
- For dropdown fields, return the closest matching option from the provided list
- For number fields, return a numeric string (e.g. "22.5")
- For text fields, return the exact text found`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
          },
        ],
      },
    ],
    max_tokens: 500,
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  let extracted: Record<string, string | null> = {}
  try {
    extracted = JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) extracted = JSON.parse(match[0])
  }

  // Remove null values
  Object.keys(extracted).forEach(k => {
    if (extracted[k] === null) delete extracted[k]
  })

  return Response.json({ extracted })
}
