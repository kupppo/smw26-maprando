import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { env } from '@/env'
import InertiaAPI from '@/lib/inertia'
import UserSelect from './user-select'

export default async function LoginPage() {
  const tournamentSlug = env.TOURNAMENT_SLUG
  const users = await InertiaAPI(`/api/tournaments/${tournamentSlug}/users`, {
    method: 'GET',
  })
  if (!users) {
    return notFound()
  }

  const sortedUsers = users.sort((a: any, b: any) =>
    a.name.localeCompare(b.name)
  )

  return (
    <div className="min-h-screen flex flex-col justify-center items-center w-full md:w-1/2 max-w-[500px] mx-auto px-4 text-center gap-y-8">
      <Suspense>
        <UserSelect users={sortedUsers} />
      </Suspense>
    </div>
  )
}
