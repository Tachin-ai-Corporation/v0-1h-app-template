"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useNavigation } from "@/contexts/navigation-context"

export function AuthExitDialog() {
  const { showAuthExitDialog, confirmAuthExit, cancelAuthExit } = useNavigation()

  return (
    <Dialog open={showAuthExitDialog} onOpenChange={(open) => !open && cancelAuthExit()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exit Application?</DialogTitle>
          <DialogDescription>Would you like to exit this app and return to 1health?</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={cancelAuthExit}>
            Stay Here
          </Button>
          <Button onClick={confirmAuthExit}>Return to 1health</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
