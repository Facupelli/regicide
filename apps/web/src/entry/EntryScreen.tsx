import { Button } from '../ui/Button.tsx';

export function EntryScreen({
  loading,
  error,
  onCreateCoop,
  onStartSolo,
  onOpenAiSettings,
  aiSummary,
  aiConfigured,
}: {
  loading: boolean;
  error: string | null;
  onCreateCoop: () => void;
  onStartSolo: () => void;
  onOpenAiSettings: () => void;
  aiSummary: string | null;
  aiConfigured: boolean;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 font-sans text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border bg-panel p-4 shadow-xl sm:p-8">
        <h1 className="text-3xl font-bold">Regicide</h1>
        <div className="mt-8 flex flex-col gap-4">
          <Button onClick={onStartSolo} disabled={loading} className="min-h-11 w-full">
            Start Solo Game
          </Button>
          <Button onClick={onCreateCoop} disabled={loading} className="min-h-11 w-full">
            Create Co-op Game
          </Button>
        </div>
        <section className="mt-8 border-t border-border pt-6" aria-label="AI Settings">
          <h2 className="text-lg font-semibold">AI Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {aiSummary ?? 'Configure AI teammates before creating a co-op game.'}
          </p>
          <Button className="mt-4 min-h-11 w-full" onClick={onOpenAiSettings} disabled={loading}>
            {aiConfigured ? 'AI Settings' : 'Configure AI'}
          </Button>
        </section>
        {loading && (
          <p role="status" className="mt-5 text-sm">
            Loading game...
          </p>
        )}
        {error && (
          <p role="alert" className="mt-5 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
