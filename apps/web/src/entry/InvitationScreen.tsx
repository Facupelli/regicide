import { Button } from '../ui/Button.tsx';

export function InvitationScreen({ error, onBack }: { error: string | null; onBack: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 font-sans text-foreground">
      <section className="w-full max-w-md rounded-xl border border-border bg-panel p-4 shadow-xl sm:p-8">
        <h1 className="text-3xl font-bold">Regicide</h1>
        {error ? (
          <>
            <p role="alert" className="mt-6 text-sm text-danger">
              {error}
            </p>
            <Button className="mt-6 min-h-11 w-full" onClick={onBack}>
              Back to home
            </Button>
          </>
        ) : (
          <p role="status" className="mt-6 text-sm text-muted-foreground">
            Joining game...
          </p>
        )}
      </section>
    </main>
  );
}
