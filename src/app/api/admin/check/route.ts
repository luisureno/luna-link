import { NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  return Response.json({ authed: await isAdmin(request) })
}
