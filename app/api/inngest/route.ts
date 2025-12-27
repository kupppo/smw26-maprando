import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import {
  handleModeSelection,
  handleRaceScheduled,
  handleRaceStart,
  sendConfirmationMessage,
} from '@/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    handleRaceStart,
    handleRaceScheduled,
    handleModeSelection,
    sendConfirmationMessage,
  ],
})
