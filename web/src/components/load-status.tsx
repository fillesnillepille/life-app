import { CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <p className="flex items-start gap-2 text-sm" role="alert">
        <CircleAlert
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden
        />
        {message}
      </p>
      <Button
        variant="outline"
        className="h-11 shrink-0 lg:h-8"
        onClick={onRetry}
      >
        <RefreshCw aria-hidden />
        Försök igen
      </Button>
    </div>
  )
}

export function Loading({ children }: { children: string }) {
  return (
    <p
      className="flex items-center gap-2 p-3 text-sm text-muted-foreground"
      role="status"
    >
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      {children}
    </p>
  )
}
