import { Button } from '../ui/Button.tsx';

export function InvitationScreen({
  error,
  onBack,
  onJoin,
  onResume,
  onRetry,
  message = 'Joining game...',
}: {
  error: string | null;
  onBack: () => void;
  onJoin?: (() => void) | undefined;
  onResume?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
  message?: string | undefined;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 font-sans text-foreground">
      <section className="w-full max-w-md rounded-xl border border-border bg-panel p-4 shadow-xl sm:p-8">
        <h1 className="text-3xl font-bold">Regicide</h1>
        {error && (
          <>
            <p role="alert" className="mt-6 text-sm text-danger">
              {error}
            </p>
            {onRetry && (
              <Button className="mt-6 min-h-11 w-full" onClick={onRetry}>
                Try again
              </Button>
            )}
            {onJoin && (
              <Button className="mt-6 min-h-11 w-full" onClick={onJoin}>
                Join invited game
              </Button>
            )}
            <Button className="mt-3 min-h-11 w-full" onClick={onBack}>
              {onResume ? 'Resume current game' : 'Back to home'}
            </Button>
          </>
        )}
        {!error && onJoin && (
          <>
            <p className="mt-6 text-sm text-muted-foreground">
              You are already in another game. Joining this invitation will replace the saved game
              in this tab.
            </p>
            <Button className="mt-6 min-h-11 w-full" onClick={onJoin}>
              Join invited game
            </Button>
            <Button className="mt-3 min-h-11 w-full" onClick={onBack}>
              Resume current game
            </Button>
          </>
        )}
        {!error && !onJoin && (
          <p role="status" className="mt-6 text-sm text-muted-foreground">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
