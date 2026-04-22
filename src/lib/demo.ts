export const DEMO_EMAILS = [
  'demo.solo@fleetwisehq.com',
  'owner@mesarock.com',
] as const

export const SOLO_DEMO_EMAIL = 'demo.solo@fleetwisehq.com'
export const SOLO_DEMO_PASSWORD = 'Demo1234!'

export const FLEET_DEMO_EMAIL = 'owner@mesarock.com'
export const FLEET_DEMO_PASSWORD = 'password123'

export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return (DEMO_EMAILS as readonly string[]).includes(email.toLowerCase())
}
