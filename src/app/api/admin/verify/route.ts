import { NextRequest } from 'next/server'
import { ADMIN_COOKIE } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  const { password } = await request.json()
  const expected = process.env.ADMIN_PASSWORD

  if (!expected) {
    return Response.json({ error: 'Admin password not configured' }, { status: 500 })
  }

  if (password !== expected) {
    return Response.json({ error: 'Invalid password' }, { status: 401 })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${ADMIN_COOKIE}=${encodeURIComponent(expected)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    },
  })
}
