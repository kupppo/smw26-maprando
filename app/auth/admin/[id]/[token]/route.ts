import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import InertiaAPI from '@/lib/inertia'

export const dynamic = 'force-dynamic'

const fetchAuth = (id: string) => {
  try {
    return InertiaAPI(`/api/metafields/tournamentOrganizer/${id}/authToken`, {
      method: 'GET',
    })
  } catch (err: unknown) {
    const error = err as Error
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Unauthorized')
    }
    return null
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params
    const metafield = await fetchAuth(id)
    if (!metafield) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Expire cookie 6 months from now
    const expiresAt = new Date(Date.now() + 6 * 30.44 * 24 * 60 * 60 * 1000)

    const cookieStore = await cookies()
    cookieStore.set('inertia-auth', `${id}:${token}`, {
      httpOnly: true,
      secure: true,
      expires: expiresAt,
    })

    const returnTo = req.nextUrl.searchParams.get('returnTo')
    if (returnTo) {
      const returnUrl = new URL(returnTo, req.nextUrl.origin)
      return NextResponse.redirect(returnUrl.toString())
    }

    const redirectUrl = new URL('/admin', req.nextUrl.origin)
    return NextResponse.redirect(redirectUrl.toString())
  } catch (err: unknown) {
    const error = err as Error
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    throw error
  }
}
