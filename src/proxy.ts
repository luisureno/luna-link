import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/join') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api')

  // Unauthenticated users → /login (unless on a public page)
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated: fetch role and guard routes
  if (user) {
    if (pathname === '/login' || pathname === '/' || pathname.startsWith('/signup') || pathname.startsWith('/join') || pathname.startsWith('/admin')) {
      // Let the page handle routing for logged-in users
      return supabaseResponse
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    const role = (profile as { role?: string } | null)?.role
    const companyId = (profile as { company_id?: string } | null)?.company_id

    let accountType: string = 'fleet'
    if (companyId) {
      const { data: co } = await supabase
        .from('companies')
        .select('account_type')
        .eq('id', companyId)
        .single()
      accountType = (co as { account_type?: string } | null)?.account_type ?? 'fleet'
    }

    // Drivers → /driver only
    if (role === 'driver') {
      if (pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/driver', request.url))
      }
      return supabaseResponse
    }

    // Solo owners: combined view — may use /driver/* routes, and /dashboard → /dashboard/solo
    if (role === 'owner' && accountType === 'solo') {
      if (pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/solo')) {
        return NextResponse.redirect(new URL('/dashboard/solo', request.url))
      }
      return supabaseResponse
    }

    // Fleet/enterprise owners + dispatchers: /dashboard only
    if (role === 'owner' || role === 'dispatcher') {
      if (pathname.startsWith('/dashboard/solo')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      if (pathname.startsWith('/driver')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|manifest.json).*)'],
}
