import { beforeEach, describe, expect, type Mock, test, vi } from 'vitest'
import InertiaAPI from '@/lib/inertia'
import { send as inngestSend } from '@/lib/inngest'
import { setRaceMode, setS3Veto } from './match'

vi.mock('@/lib/inertia', () => {
  return {
    default: vi.fn(),
  }
})

vi.mock('@/lib/inngest', () => {
  return {
    send: vi.fn(),
  }
})

describe('Match Actions', () => {
  const mockInertiaCall = InertiaAPI as Mock
  const mockInngestSend = inngestSend as Mock

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('TOURNAMENT_SLUG', 'test-tournament')
  })

  describe('setRaceMode', () => {
    test('s3-multi-categories triggers S3 veto flow (no mode.select yet)', async () => {
      mockInertiaCall.mockResolvedValue({ data: 'ok' })

      await setRaceMode(
        's3-multi-categories',
        'match-1',
        'player_2_pick',
        'https://racetime.gg/room/123'
      )

      // First call: POST the pick
      expect(mockInertiaCall).toHaveBeenNthCalledWith(1, '/api/metafields', {
        method: 'POST',
        payload: {
          model: 'match',
          modelId: 'match-1',
          key: 'player_2_pick',
          value: 's3-multi-categories',
        },
      })

      // Second call: PUT status to S3_P1_VETO_1
      expect(mockInertiaCall).toHaveBeenNthCalledWith(2, '/api/metafields', {
        method: 'PUT',
        payload: {
          model: 'match',
          modelId: 'match-1',
          key: 'status',
          value: 'S3_P1_VETO_1',
        },
      })

      expect(mockInertiaCall).toHaveBeenCalledTimes(2)
      // mode.select should NOT be called for S3 (it's called after vetoes complete)
      expect(mockInngestSend).not.toHaveBeenCalled()
    })

    test('non-S3 mode fires mode.select event (player_2_pick)', async () => {
      mockInertiaCall.mockResolvedValue({ data: 'ok' })

      await setRaceMode(
        'item-draft',
        'match-1',
        'player_2_pick',
        'https://racetime.gg/room/123'
      )

      expect(mockInertiaCall).toHaveBeenNthCalledWith(2, '/api/metafields', {
        method: 'PUT',
        payload: {
          model: 'match',
          modelId: 'match-1',
          key: 'status',
          value: 'PLAYING_RACE_2',
        },
      })

      // mode.select should be called
      expect(mockInngestSend).toHaveBeenCalledWith({
        name: 'super-metroid-winter-2026-map-rando-tournament/mode.select',
        data: {
          mode: 'item-draft',
          roomUrl: 'https://racetime.gg/room/123',
        },
      })
    })

    test('non-S3 mode fires mode.select event (player_1_pick)', async () => {
      mockInertiaCall.mockResolvedValue({ data: 'ok' })

      await setRaceMode(
        'random-objectives',
        'match-1',
        'player_1_pick',
        'https://racetime.gg/room/456'
      )

      expect(mockInertiaCall).toHaveBeenNthCalledWith(2, '/api/metafields', {
        method: 'PUT',
        payload: {
          model: 'match',
          modelId: 'match-1',
          key: 'status',
          value: 'PLAYING_RACE_1',
        },
      })

      expect(mockInngestSend).toHaveBeenCalledWith({
        name: 'super-metroid-winter-2026-map-rando-tournament/mode.select',
        data: {
          mode: 'random-objectives',
          roomUrl: 'https://racetime.gg/room/456',
        },
      })
    })
  })

  describe('setS3Veto', () => {
    test('s3_p1_veto_1 transitions to S3_P2_VETO_1', async () => {
      mockInertiaCall.mockResolvedValue({ data: 'ok' })

      await setS3Veto(
        'no-objectives',
        'match-1',
        's3_p1_veto_1',
        'player_2_pick',
        'https://racetime.gg/room/123'
      )

      // First call: POST the veto
      expect(mockInertiaCall).toHaveBeenNthCalledWith(1, '/api/metafields', {
        method: 'POST',
        payload: {
          model: 'match',
          modelId: 'match-1',
          key: 's3_p1_veto_1',
          value: 'no-objectives',
        },
      })

      // Second call: PUT status to S3_P2_VETO_1
      expect(mockInertiaCall).toHaveBeenNthCalledWith(2, '/api/metafields', {
        method: 'PUT',
        payload: {
          model: 'match',
          modelId: 'match-1',
          key: 'status',
          value: 'S3_P2_VETO_1',
        },
      })

      // mode.select should NOT be called yet
      expect(mockInngestSend).not.toHaveBeenCalled()
    })

    test('s3_p2_veto_1 transitions to S3_P2_VETO_2', async () => {
      mockInertiaCall.mockResolvedValue({ data: 'ok' })

      await setS3Veto(
        'mo-nm2',
        'match-1',
        's3_p2_veto_1',
        'player_2_pick',
        'https://racetime.gg/room/123'
      )

      expect(mockInertiaCall).toHaveBeenNthCalledWith(2, '/api/metafields', {
        method: 'PUT',
        payload: {
          model: 'match',
          modelId: 'match-1',
          key: 'status',
          value: 'S3_P2_VETO_2',
        },
      })
    })

    test('s3_p2_veto_2 transitions to S3_P1_VETO_2', async () => {
      mockInertiaCall.mockResolvedValue({ data: 'ok' })

      await setS3Veto(
        'double-suit',
        'match-1',
        's3_p2_veto_2',
        'player_2_pick',
        'https://racetime.gg/room/123'
      )

      expect(mockInertiaCall).toHaveBeenNthCalledWith(2, '/api/metafields', {
        method: 'PUT',
        payload: {
          model: 'match',
          modelId: 'match-1',
          key: 'status',
          value: 'S3_P1_VETO_2',
        },
      })
    })

    test('s3_p1_veto_2 fires mode.select with s3Mode', async () => {
      // Mock match with existing vetoes
      const mockMatch = {
        metafields: [
          { key: 's3_p1_veto_1', value: 'no-objectives' },
          { key: 's3_p2_veto_1', value: 'mo-nm2' },
          { key: 's3_p2_veto_2', value: 'double-suit' },
        ],
      }

      mockInertiaCall.mockImplementation(
        (endpoint: string, options: { method: string }) => {
          if (options.method === 'GET') {
            return Promise.resolve(mockMatch)
          }
          return Promise.resolve({ data: 'ok' })
        }
      )

      // Final veto is 'gravity', leaving 'vhsig' as remaining
      const result = await setS3Veto(
        'gravity',
        'match-1',
        's3_p1_veto_2',
        'player_2_pick',
        'https://racetime.gg/room/123'
      )

      expect(result).toEqual('vhsig')

      // Should POST the final veto
      expect(mockInertiaCall).toHaveBeenNthCalledWith(1, '/api/metafields', {
        method: 'POST',
        payload: {
          model: 'match',
          modelId: 'match-1',
          key: 's3_p1_veto_2',
          value: 'gravity',
        },
      })

      // Should GET match to compute remaining mode
      expect(mockInertiaCall).toHaveBeenNthCalledWith(
        2,
        '/api/tournaments/test-tournament/matches/match-1',
        { method: 'GET' }
      )

      // Should POST s3_selected_mode
      expect(mockInertiaCall).toHaveBeenNthCalledWith(3, '/api/metafields', {
        method: 'POST',
        payload: {
          model: 'match',
          modelId: 'match-1',
          key: 's3_selected_mode',
          value: 'vhsig',
        },
      })

      // Should PUT status to PLAYING_RACE_2 (player_2_pick)
      expect(mockInertiaCall).toHaveBeenNthCalledWith(4, '/api/metafields', {
        method: 'PUT',
        payload: {
          model: 'match',
          modelId: 'match-1',
          key: 'status',
          value: 'PLAYING_RACE_2',
        },
      })

      // Should fire mode.select with s3Mode
      expect(mockInngestSend).toHaveBeenCalledWith({
        name: 'super-metroid-winter-2026-map-rando-tournament/mode.select',
        data: {
          mode: 's3-multi-categories',
          s3Mode: 'vhsig',
          roomUrl: 'https://racetime.gg/room/123',
        },
      })
    })

    test('s3_p1_veto_2 with player_1_pick transitions to PLAYING_RACE_1', async () => {
      const mockMatch = {
        metafields: [
          { key: 's3_p1_veto_1', value: 'no-objectives' },
          { key: 's3_p2_veto_1', value: 'mo-nm2' },
          { key: 's3_p2_veto_2', value: 'double-suit' },
        ],
      }

      mockInertiaCall.mockImplementation(
        (endpoint: string, options: { method: string }) => {
          if (options.method === 'GET') {
            return Promise.resolve(mockMatch)
          }
          return Promise.resolve({ data: 'ok' })
        }
      )

      await setS3Veto(
        'gravity',
        'match-1',
        's3_p1_veto_2',
        'player_1_pick',
        'https://racetime.gg/room/456'
      )

      // Should PUT status to PLAYING_RACE_1 (player_1_pick)
      expect(mockInertiaCall).toHaveBeenCalledWith('/api/metafields', {
        method: 'PUT',
        payload: {
          model: 'match',
          modelId: 'match-1',
          key: 'status',
          value: 'PLAYING_RACE_1',
        },
      })

      // Should fire mode.select
      expect(mockInngestSend).toHaveBeenCalledWith({
        name: 'super-metroid-winter-2026-map-rando-tournament/mode.select',
        data: {
          mode: 's3-multi-categories',
          s3Mode: 'vhsig',
          roomUrl: 'https://racetime.gg/room/456',
        },
      })
    })

    test('s3_p1_veto_2 with game_3_mode transitions to PLAYING_RACE_3', async () => {
      const mockMatch = {
        metafields: [
          { key: 's3_p1_veto_1', value: 'no-objectives' },
          { key: 's3_p2_veto_1', value: 'mo-nm2' },
          { key: 's3_p2_veto_2', value: 'double-suit' },
        ],
      }

      mockInertiaCall.mockImplementation(
        (endpoint: string, options: { method: string }) => {
          if (options.method === 'GET') {
            return Promise.resolve(mockMatch)
          }
          return Promise.resolve({ data: 'ok' })
        }
      )

      const result = await setS3Veto(
        'gravity',
        'match-1',
        's3_p1_veto_2',
        'game_3_mode',
        'https://racetime.gg/room/789'
      )

      expect(result).toEqual('vhsig')

      // Should PUT status to PLAYING_RACE_3 (game_3_mode)
      expect(mockInertiaCall).toHaveBeenCalledWith('/api/metafields', {
        method: 'PUT',
        payload: {
          model: 'match',
          modelId: 'match-1',
          key: 'status',
          value: 'PLAYING_RACE_3',
        },
      })

      // Should fire mode.select with s3Mode
      expect(mockInngestSend).toHaveBeenCalledWith({
        name: 'super-metroid-winter-2026-map-rando-tournament/mode.select',
        data: {
          mode: 's3-multi-categories',
          s3Mode: 'vhsig',
          roomUrl: 'https://racetime.gg/room/789',
        },
      })
    })
  })
})
