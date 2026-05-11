import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request)

  // ─── ADMIN SUBDOMAIN ROUTING ──────────────────────────────────────────────
  // dashboard.trapeziapp.com (prod) and dashboard.localhost:3000 (dev) are
  // handled here. Requests are rewritten to /admin/* app routes.
  const host = request.headers.get('host') ?? ''
  const isDashboard =
    host === 'dashboard.trapeziapp.com' ||
    host === 'dashboard.localhost:3000'

  if (isDashboard) {
    const pathname = request.nextUrl.pathname

    // Derive the canonical admin path: strip a leading /admin if already present
    // so we don't double-prefix when someone navigates directly to /admin/...
    const adminRelative = pathname.startsWith('/admin') ? pathname : `/admin${pathname}`

    // Allow the login page through without an auth check
    if (adminRelative === '/admin/login' || adminRelative.startsWith('/admin/login/')) {
      return NextResponse.rewrite(new URL(adminRelative, request.url))
    }

    // All other admin routes require a valid session + admin role
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.host = host
      return NextResponse.redirect(loginUrl)
    }

    const { data: staffRow } = await supabase
      .from('staff')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!staffRow || staffRow.role !== 'admin') {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.host = host
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.rewrite(new URL(adminRelative, request.url))
  }
  // ─────────────────────────────────────────────────────────────────────────

  // 1. SESSION REFRESH
  // This will refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Customer facing routes: /slug or /slug/...
  // Non-customer routes: /login, /admin, /api, static assets, etc.

  const segments = path.split('/').filter(Boolean)
  const isCustomSlug = segments.length > 0 && !['admin', 'api', '_next', 'favicon.ico'].includes(segments[0])
  const slug = isCustomSlug ? segments[0] : null

  // 4. SLUG VALIDATION (Customer-facing routes only)
  if (slug) {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (!restaurant) {
      // Slug not found or restaurant inactive -> 404
      return new NextResponse(null, { status: 404, statusText: 'Not Found' })
    }
  }

  // 2. ROUTE PROTECTION & 3. ROLE ENFORCEMENT
  // Paths that require auth
  const isProtected = path.includes('/kitchen') ||
                      path.includes('/bar') ||
                      path.includes('/cashier') ||
                      path.includes('/dashboard') ||
                      path.includes('/owner') ||
                      path.startsWith('/admin')

  if (isProtected) {
    if (!user) {
      // Not logged in -> redirect to slug-scoped login
      const loginUrl = new URL(`/${segments[0]}/login`, request.url)
      return NextResponse.redirect(loginUrl)
    }

    // Check staff role
    const { data: staffData } = await supabase
      .from('staff')
      .select('role, restaurant_id, restaurants(slug)')
      .eq('id', user.id)
      .single()

    if (staffData && staffData.restaurants && !Array.isArray(staffData.restaurants)) {
      const userRole = staffData.role
      const userRestaurantSlug = (staffData.restaurants as any).slug

      let expectedPrefix = ''
      if (userRole === 'admin') {
        expectedPrefix = '/admin'
      } else if (userRole === 'kitchen') {
        expectedPrefix = `/${userRestaurantSlug}/kitchen`
      } else if (userRole === 'bar') {
        expectedPrefix = `/${userRestaurantSlug}/bar`
      } else if (userRole === 'cashier') {
        expectedPrefix = `/${userRestaurantSlug}/cashier`
      } else if (userRole === 'owner') {
        expectedPrefix = `/${userRestaurantSlug}/owner`
      } else if (userRole === 'manager') {
        expectedPrefix = `/${userRestaurantSlug}/owner`
      }

      if (expectedPrefix && !path.startsWith(expectedPrefix)) {
        // Redirect to their correct route
        return NextResponse.redirect(new URL(expectedPrefix, request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
