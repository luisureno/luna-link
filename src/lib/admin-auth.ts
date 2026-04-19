import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const ADMIN_COOKIE = 'hp_admin'

export async function isAdmin(request?: NextRequest): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false

  const value = request
    ? request.cookies.get(ADMIN_COOKIE)?.value
    : (await cookies()).get(ADMIN_COOKIE)?.value

  return value === expected
}
