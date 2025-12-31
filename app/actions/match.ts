'use server'

import { S3Modes } from '@/app/config/tournament'
import InertiaAPI from '@/lib/inertia'
import { send as inngestSend } from '@/lib/inngest'

export const setFirstPlayer = async (playerId: string, matchId: string) => {
  const url = '/api/metafields'
  await InertiaAPI(url, {
    method: 'POST',
    payload: {
      model: 'match',
      modelId: matchId,
      key: 'player_1',
      value: playerId,
    },
  })
  await InertiaAPI(url, {
    method: 'PUT',
    payload: {
      model: 'match',
      modelId: matchId,
      key: 'status',
      value: 'PLAYER_1_PICK',
    },
  })
  return true
}

export const setRaceMode = async (
  modeId: string,
  matchId: string,
  key: string,
  racetimeUrl: string
) => {
  const url = '/api/metafields'
  await InertiaAPI(url, {
    method: 'POST',
    payload: {
      model: 'match',
      modelId: matchId,
      key,
      value: modeId,
    },
  })

  // If s3-multi-categories picked, go to S3 veto flow (mode.select fired after S3 vetoes complete)
  if (modeId === 's3-multi-categories') {
    await InertiaAPI(url, {
      method: 'PUT',
      payload: {
        model: 'match',
        modelId: matchId,
        key: 'status',
        value: 'S3_P1_VETO_1',
      },
    })
    return true
  }

  const newStatus =
    key === 'player_1_pick' ? 'PLAYING_RACE_1' : 'PLAYING_RACE_2'
  await InertiaAPI(url, {
    method: 'PUT',
    payload: {
      model: 'match',
      modelId: matchId,
      key: 'status',
      value: newStatus,
    },
  })

  // Fire mode.select event to update racetime
  await inngestSend({
    name: 'super-metroid-winter-2026-map-rando-tournament/mode.select',
    data: {
      mode: modeId,
      roomUrl: racetimeUrl,
    },
  })

  return true
}

export const setS3Veto = async (
  modeId: string,
  matchId: string,
  key: string,
  pickKey: string,
  racetimeUrl: string
) => {
  const url = '/api/metafields'

  // Store the veto
  await InertiaAPI(url, {
    method: 'POST',
    payload: {
      model: 'match',
      modelId: matchId,
      key,
      value: modeId,
    },
  })

  // Determine next state
  const stateMap: Record<string, string> = {
    s3_p1_veto_1: 'S3_P2_VETO_1',
    s3_p2_veto_1: 'S3_P2_VETO_2',
    s3_p2_veto_2: 'S3_P1_VETO_2',
  }

  // If final veto, compute remaining mode and finalize
  if (key === 's3_p1_veto_2') {
    // Get all vetoes to compute remaining mode
    const tournamentSlug = process.env.TOURNAMENT_SLUG
    const match = await InertiaAPI(
      `/api/tournaments/${tournamentSlug}/matches/${matchId}`,
      { method: 'GET' }
    )

    const getVeto = (k: string) =>
      match.metafields.find((m: any) => m.key === k)?.value || null

    const vetoes = [
      getVeto('s3_p1_veto_1'),
      getVeto('s3_p2_veto_1'),
      getVeto('s3_p2_veto_2'),
      modeId, // current veto not yet in metafields
    ].filter(Boolean)

    const remaining = S3Modes.find((m) => !vetoes.includes(m.slug))
    if (!remaining) {
      throw new Error('No S3 mode remaining after vetoes')
    }

    // Store selected S3 mode
    await InertiaAPI(url, {
      method: 'POST',
      payload: {
        model: 'match',
        modelId: matchId,
        key: 's3_selected_mode',
        value: remaining.slug,
      },
    })

    // Transition to race based on which pick triggered S3 flow
    const newStatus =
      pickKey === 'player_1_pick' ? 'PLAYING_RACE_1' : 'PLAYING_RACE_2'
    await InertiaAPI(url, {
      method: 'PUT',
      payload: {
        model: 'match',
        modelId: matchId,
        key: 'status',
        value: newStatus,
      },
    })

    // Fire mode.select event with S3 mode info
    await inngestSend({
      name: 'super-metroid-winter-2026-map-rando-tournament/mode.select',
      data: {
        mode: 's3-multi-categories',
        s3Mode: remaining.slug,
        roomUrl: racetimeUrl,
      },
    })

    return remaining.slug
  }

  // Otherwise, transition to next S3 veto state
  await InertiaAPI(url, {
    method: 'PUT',
    payload: {
      model: 'match',
      modelId: matchId,
      key: 'status',
      value: stateMap[key],
    },
  })
  return true
}

export const setHigherSeed = async (playerId: string, matchId: string) => {
  const url = '/api/metafields'
  try {
    await InertiaAPI(url, {
      method: 'POST',
      payload: {
        model: 'match',
        modelId: matchId,
        key: 'higher_seed',
        value: playerId,
      },
    })
  } catch (err) {
    await InertiaAPI(url, {
      method: 'PUT',
      payload: {
        model: 'match',
        modelId: matchId,
        key: 'higher_seed',
        value: playerId,
      },
    })
  }
  await InertiaAPI(url, {
    method: 'PUT',
    payload: {
      model: 'match',
      modelId: matchId,
      key: 'status',
      value: 'AWAITING_PLAYER_ASSIGNMENT',
    },
  })
  return true
}
