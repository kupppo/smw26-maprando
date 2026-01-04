import { NonRetriableError } from 'inngest'
import { RaceModes, S3Modes } from '@/app/config/tournament'
import { env } from '@/env'
import InertiaAPI from '@/lib/inertia'
import { send as inngestSend } from '@/lib/inngest'
import { inngest } from '../client'

type RaceEventData = {
  matchId: string
  raceId: string
  racetimeUrl: string
}

type RaceModeEventData = {
  racetimeUrl: string
  mode: string
  s3Mode?: string
}

export const handleRaceStart = inngest.createFunction(
  { id: 'handle-race-start' },
  { event: 'super-metroid-winter-2026-map-rando-tournament/race.initiate' },
  async ({ event, step }) => {
    const data = event.data as RaceEventData
    const matchUrl = new URL(`match/${data.matchId}`, env.NEXT_PUBLIC_URL)

    // Get match
    const match = await step.run('get-match', async () => {
      const tournamentSlug = process.env.TOURNAMENT_SLUG!
      const entry = await InertiaAPI(
        `/api/tournaments/${tournamentSlug}/matches/${data.matchId}`,
        {
          method: 'GET',
        }
      )
      if (!entry) {
        throw new NonRetriableError('Match not found')
      }
      return entry
    })

    // Determine if last race or not
    const lastRace = await step.run('determine-race-number', async () => {
      const race = match.races.find((race: any) => race.id === data.raceId)
      if (!race) {
        throw new NonRetriableError('Race not found')
      }

      const raceNumber = race.ordering
      if (raceNumber === 2) {
        return true
      }

      return false
    })

    // Send message if not last race
    if (lastRace) {
      await step.run('set-final-match', async () => {
        // Assign random mode not already picked
        // Broadcast changes to racetime room
        const selectedKeys = [
          'player_1_pick',
          'player_2_pick',
          'player_1_veto',
          'player_2_veto',
        ]
        const selectedModes = match.metafields
          .filter((metafield: any) => selectedKeys.includes(metafield.key))
          .map((metafield: any) => metafield.value)
        const nonSelectedModes = RaceModes.filter(
          (mode) => !selectedModes.includes(mode.slug)
        )
        const randomMode =
          nonSelectedModes[Math.floor(Math.random() * nonSelectedModes.length)]

        // Set mode in Inertia
        await InertiaAPI('/api/metafields', {
          method: 'POST',
          payload: {
            key: 'game_3_mode',
            value: randomMode.slug,
            model: 'match',
            modelId: data.matchId,
          },
        })

        // If s3-multi-categories, go to S3 veto flow instead of starting race
        if (randomMode.slug === 's3-multi-categories') {
          const msg = `This race will be S3 Multi Categories. Players must now veto sub-modes: ${matchUrl.toString()}`
          await InertiaAPI('/api/racetime/race/msg', {
            method: 'POST',
            payload: {
              msg,
              roomUrl: data.racetimeUrl,
            },
          })

          await InertiaAPI('/api/metafields', {
            method: 'PUT',
            payload: {
              key: 'status',
              value: 'S3_P1_VETO_1',
              model: 'match',
              modelId: data.matchId,
            },
          })
          return randomMode.slug
        }

        await inngestSend({
          name: 'super-metroid-winter-2026-map-rando-tournament/mode.select',
          data: {
            mode: randomMode.slug,
            roomUrl: data.racetimeUrl,
          },
        })

        // Send message to racetime
        const msg = `This race will be set to ${randomMode.name} shortly.`
        await InertiaAPI('/api/racetime/race/msg', {
          method: 'POST',
          payload: {
            msg,
            roomUrl: data.racetimeUrl,
          },
        })

        // Progress match
        await InertiaAPI('/api/metafields', {
          method: 'PUT',
          payload: {
            key: 'status',
            value: 'PLAYING_RACE_3',
            model: 'match',
            modelId: data.matchId,
          },
        })
        return randomMode.slug
      })
    } else {
      await step.run('progress-match', async () => {
        const matchState = match.metafields.find(
          (metafield: any) => metafield.key === 'status'
        )
        if (!matchState) {
          throw new NonRetriableError('Match Metafield not found')
        }

        // If it's the first race, the status should be AWAITING_PLAYER_ASSIGNMENT and needs no update
        // If it's the start of the second race, update the status
        if (matchState.value === 'PLAYING_RACE_1') {
          await InertiaAPI('/api/metafields', {
            method: 'PUT',
            payload: {
              key: 'status',
              value: 'PLAYER_2_PICK',
              model: 'match',
              modelId: data.matchId,
            },
          })
        }
      })

      const awaitScheduledTime = await step.run(
        'await-scheduled-time',
        async () => {
          const race = match.races.find((race: any) => race.id === data.raceId)
          if (!race) {
            return null
          }
          if (race.scheduleOnFinish) {
            return null
          }
          if (race.scheduledAt) {
            try {
              const scheduledTime = new Date(race.scheduledAt)
              scheduledTime.setMinutes(scheduledTime.getMinutes() - 15)
              return scheduledTime.toISOString()
            } catch (err) {
              return null
            }
          }
          return null
        }
      )

      if (awaitScheduledTime) {
        await step.run('send-initial-message', async () => {
          const msg =
            'The options for this race will be sent to this room 10 minutes prior to the scheduled time.'
          await InertiaAPI('/api/racetime/race/msg', {
            method: 'POST',
            payload: {
              msg,
              roomUrl: data.racetimeUrl,
            },
          })
        })
        await step.sleepUntil('wait-until-15m-prior', awaitScheduledTime)
      }

      await step.run('send-msg', async () => {
        const msg = `Please visit ${matchUrl.toString()} to setup the options for this race`
        await InertiaAPI('/api/racetime/race/msg', {
          method: 'POST',
          payload: {
            msg,
            roomUrl: data.racetimeUrl,
          },
        })
      })
    }
  }
)

export const handleRaceScheduled = inngest.createFunction(
  { id: 'handle-race-scheduled' },
  { event: 'super-metroid-winter-2026-map-rando-tournament/race.scheduled' },
  async ({ event, step }) => {
    const data = event.data as RaceEventData
    await step.run('setup-match', async () => {
      const tournamentSlug = process.env.TOURNAMENT_SLUG!
      const match = await InertiaAPI(
        `/api/tournaments/${tournamentSlug}/matches/${data.matchId}`,
        {
          method: 'GET',
        }
      )
      if (!match) {
        throw new NonRetriableError('Match not found')
      }

      const statusMetafield = match.metafields.find(
        (metafield: any) => metafield.key === 'status'
      )

      if (!statusMetafield) {
        await InertiaAPI('/api/metafields', {
          method: 'POST',
          payload: {
            key: 'status',
            value: 'AWAITING_PLAYER_ASSIGNMENT',
            model: 'match',
            modelId: data.matchId,
          },
        })
      }

      const higherSeedMetafield = match.metafields.find(
        (metafield: any) => metafield.key === 'higher_seed'
      )
      if (!higherSeedMetafield) {
        const racers = match.racers
        const higherSeed = racers.sort(
          (a: any, b: any) =>
            Number.parseInt(a.initialSeed) - Number.parseInt(b.initialSeed)
        )[0]
        await InertiaAPI('/api/metafields', {
          method: 'POST',
          payload: {
            key: 'higher_seed',
            value: higherSeed.id,
            model: 'match',
            modelId: data.matchId,
          },
        })
      }
    })
  }
)

export const handleModeSelection = inngest.createFunction(
  { id: 'handle-mode-selection' },
  { event: 'super-metroid-winter-2026-map-rando-tournament/mode.select' },
  async ({ event, step }) => {
    const data = event.data
    await step.run('set-mode-on-racetime', async () => {
      const mode = RaceModes.find((mode) => mode.slug === data.mode)
      if (!mode) {
        throw new NonRetriableError(`Mode not found: ${data.mode}`)
      }

      // Build display name, including S3 sub-mode if applicable
      let displayName = mode.name
      if (data.mode === 's3-multi-categories' && data.s3Mode) {
        const s3Mode = S3Modes.find((m) => m.slug === data.s3Mode)
        if (s3Mode) {
          displayName = `${mode.name} (${s3Mode.name})`
        }
      }

      await InertiaAPI('/api/racetime/race', {
        method: 'PUT',
        payload: {
          roomUrl: data.roomUrl,
          info_bot: displayName,
        },
      })
    })
  }
)

export const sendConfirmationMessage = inngest.createFunction(
  { id: 'send-confirmation-msg' },
  { event: 'super-metroid-winter-2026-map-rando-tournament/confirmation.send' },
  async ({ event, step }) => {
    const data = event.data as { userId: string }
    const tournamentSlug = env.TOURNAMENT_SLUG
    const user = await step.run('get-user', async () => {
      const record = await InertiaAPI(
        `/api/tournaments/${tournamentSlug}/users/${data.userId}`,
        {
          method: 'GET',
        }
      )
      if (!record) {
        throw new NonRetriableError('User not found')
      }
      return record
    })
    const authMetafield = user.metafields.find(
      (metafield: any) => metafield.key === 'authToken'
    )
    if (!authMetafield) {
      throw new NonRetriableError('Auth token not found')
    }
    await step.run('send-confirmation-message', async () => {
      const setupUrl = new URL(
        `/auth/${user.id}/${authMetafield.value}`,
        env.NEXT_PUBLIC_URL
      )
      const msg = `Thank you for signing up for the Super Metroid Winter 2026 Map Rando Tournament. **Please confirm your participation here ASAP**:\n${setupUrl.toString()}\n\nIf you cannot confirm participation, you may be removed from the tournament.\n\nYour Discord username will be displayed on the upcoming bracket. If you would like your display name to be something else for the bracket, please update your username after confirming your participation here:\nhttps://www.inertia.run/account/settings\n\nPlease also make sure you are also signed up to the Discord server to schedule matches and communicate with the admins: https://discord.gg/PXFSzKRH4g\n\nIf you cannot participate in the tournament, please ping or DM the tournament admins to be removed. Thank you!`
      await InertiaAPI(
        `/api/tournaments/${tournamentSlug}/users/${user.id}/msg`,
        {
          method: 'POST',
          payload: {
            msg,
          },
        }
      )
    })
  }
)
