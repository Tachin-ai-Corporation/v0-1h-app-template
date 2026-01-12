"use client"

import { useEffect, useCallback, useRef } from "react"
import { useNavigation } from "@/contexts/navigation-context"

/**
 * Hook for dialogs/modals to handle back button closing
 *
 * Usage:
 * const { onOpenChange } = useModalBackButton({
 *   isOpen,
 *   onClose: () => setIsOpen(false),
 *   modalId: "my-dialog"
 * })
 *
 * <Dialog open={isOpen} onOpenChange={onOpenChange}>
 */
export function useModalBackButton({
  isOpen,
  onClose,
  modalId,
}: {
  isOpen: boolean
  onClose: () => void
  modalId: string
}) {
  const { pushModalState, popModalState } = useNavigation()
  const hasRegisteredRef = useRef(false)

  // Push history state when modal opens
  useEffect(() => {
    if (isOpen && !hasRegisteredRef.current) {
      pushModalState(modalId)
      hasRegisteredRef.current = true
    } else if (!isOpen && hasRegisteredRef.current) {
      hasRegisteredRef.current = false
    }
  }, [isOpen, modalId, pushModalState])

  // Listen for back button close event
  useEffect(() => {
    const handleModalClose = () => {
      if (isOpen) {
        onClose()
        hasRegisteredRef.current = false
      }
    }

    window.addEventListener("navigation:modal-close", handleModalClose)
    return () => window.removeEventListener("navigation:modal-close", handleModalClose)
  }, [isOpen, onClose])

  // Wrapper for onOpenChange that handles history
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open && hasRegisteredRef.current) {
        // User closed via UI (not back button), need to go back in history
        popModalState()
        window.history.back()
        hasRegisteredRef.current = false
      }
      if (!open) {
        onClose()
      }
    },
    [onClose, popModalState],
  )

  return { onOpenChange }
}
