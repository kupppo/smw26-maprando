import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import InertiaAPI from '@/lib/inertia'
import Confirmation from './confirm'
import { AnimatedNamePill } from './username'

export default async function RunnerSetup() {
  const cookieStore = await cookies()
  const auth = cookieStore.get('inertia-auth')
  if (!auth) {
    return notFound()
  }

  const [userId, token] = auth.value.split(':')

  const tournamentSlug = process.env.TOURNAMENT_SLUG
  const user = await InertiaAPI(
    `/api/tournaments/${tournamentSlug}/users/${userId}`,
    {
      method: 'GET',
    }
  )

  if (!user) {
    return notFound()
  }

  const authMetafield = user.metafields.find(
    (metafield: any) => metafield.key === 'authToken'
  )
  if (!authMetafield || authMetafield.value !== token) {
    return notFound()
  }

  const confirmedMetafield = user.metafields.find(
    (metafield: any) => metafield.key === 'participation'
  )
  const alreadyConfirmed = confirmedMetafield?.value === 'confirmed'

  return (
    <div className="min-h-screen flex flex-col justify-center items-center w-full md:w-1/2 max-w-[500px] mx-auto px-4 text-center gap-y-8">
      <div>
        <h1 className="text-4xl leading-none">
          Super Metroid Winter 2026 Map Rando Tournament
        </h1>
        <div className="mt-4">
          <AnimatedNamePill name={user.name} />
        </div>
      </div>
      <Confirmation confirmed={alreadyConfirmed} id={user.id} />
    </div>
  )
}
