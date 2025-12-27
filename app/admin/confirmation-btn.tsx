'use client'

import { handleConfirmationMessage } from '@/app/actions/setup'
import { Button } from '@/components/ui/button'

export default function ConfirmationBtn({ id }: { id: string }) {
  return (
    <Button
      className="text-xs font-sans"
      onClick={async () => {
        try {
          await handleConfirmationMessage(id)
        } catch (error) {
          console.error(error)
        }
      }}
      variant="outline"
    >
      Send Confirmation Message
    </Button>
  )
}
