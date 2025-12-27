import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import InertiaAPI from '@/lib/inertia'

type Metafield = {
  key: string
  value: string
}

export const dynamic = 'force-dynamic'

const fetchAuth = (userId: string) => {
  const tournamentSlug = process.env.TOURNAMENT_SLUG
  return InertiaAPI(`/api/tournaments/${tournamentSlug}/users/${userId}`, {
    method: 'GET',
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; userId: string }> }
) {
  const { token, userId } = await params
  const user = await fetchAuth(userId)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const authMetafield = user.metafields.find(
    (metafield: Metafield) => metafield.key === 'authToken'
  )
  if (!authMetafield || authMetafield.value !== token) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Expire cookie 6 months from now
  const expiresAt = new Date(Date.now() + 6 * 30.44 * 24 * 60 * 60 * 1000)

  const cookieStore = await cookies()
  cookieStore.set('inertia-auth', `${userId}:${token}`, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
  })

  const returnTo = req.nextUrl.searchParams.get('returnTo')
  if (returnTo) {
    const returnUrl = new URL(returnTo, req.nextUrl.origin)
    return NextResponse.redirect(returnUrl.toString())
  }

  const redirectUrl = new URL('/setup', req.nextUrl.origin)
  return NextResponse.redirect(redirectUrl.toString())
}
