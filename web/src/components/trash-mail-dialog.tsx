import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Asks before a message is moved to the trash. The subject stays in view while
// the dialog fades out, so the caller keeps it after closing.
export function TrashMailDialog({
  subject,
  open,
  onOpenChange,
  onConfirm,
}: {
  subject: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Flytta till papperskorgen?</AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            ”{subject || 'Mejlet'}” flyttas till papperskorgen i Gmail, där det
            ligger kvar i 30 dagar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Ta bort
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
