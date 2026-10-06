import { useRef, useState } from 'react';
import type { Card, GameView, Interaction, PlayerCommand } from '@regicide/protocol';
import { ApiClientError, createGame, submitAction } from './api/games.ts';

type ScreenState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; gameId: string; view: GameView }
  | { status: 'error'; message: string };

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return `${error.message} (${error.code}, HTTP ${error.status})`;
  }
  return error instanceof Error ? error.message : fallback;
}

function App() {
  const [screen, setScreen] = useState<ScreenState>({ status: 'idle' });
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const actionInFlight = useRef(false);

  async function startGame() {
    if (screen.status === 'loading' || actionInFlight.current) return;
    setSelectedCardIds([]);
    setActionError(null);
    setScreen({ status: 'loading' });
    try {
      const response = await createGame();
      setScreen({ status: 'loaded', ...response });
    } catch (error) {
      setScreen({ status: 'error', message: errorMessage(error, 'Could not start a game') });
    }
  }

  function toggleCard(cardId: string) {
    if (actionInFlight.current) return;
    setSelectedCardIds((ids) =>
      ids.includes(cardId) ? ids.filter((id) => id !== cardId) : [...ids, cardId],
    );
  }

  async function sendAction(command: PlayerCommand) {
    if (screen.status !== 'loaded' || screen.view.status !== 'active' || actionInFlight.current) {
      return;
    }
    actionInFlight.current = true;
    setActionPending(true);
    setActionError(null);
    try {
      const response = await submitAction(screen.gameId, command);
      setScreen({ status: 'loaded', ...response });
      setSelectedCardIds([]);
    } catch (error) {
      setActionError(errorMessage(error, 'Could not submit action'));
    } finally {
      actionInFlight.current = false;
      setActionPending(false);
    }
  }

  return (
    <main>
      <h1>Regicide</h1>
      {screen.status === 'loaded' ? (
        <>
          <GameDetails
            gameId={screen.gameId}
            view={screen.view}
            selectedCardIds={selectedCardIds}
            onToggleCard={toggleCard}
            onAction={sendAction}
            actionPending={actionPending}
            actionError={actionError}
          />
          {screen.view.status === 'game-over' && (
            <button type="button" className={actionButtonClass} onClick={startGame}>
              Start New Solo Game
            </button>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            className={actionButtonClass}
            onClick={startGame}
            disabled={screen.status === 'loading'}
          >
            {screen.status === 'loading' ? 'Starting game...' : 'Start Solo Game'}
          </button>
          {screen.status === 'error' && <p role="alert">{screen.message}</p>}
        </>
      )}
    </main>
  );
}

const actionButtonClass =
  'cursor-pointer rounded border border-slate-500 bg-white px-3 py-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50';

function cardLabel(card: Card): string {
  switch (card.kind) {
    case 'number':
    case 'royal':
      return `${card.rank} of ${card.suit}`;
    case 'animal':
      return `Animal Companion of ${card.suit}`;
    case 'jester':
      return 'Jester';
  }
}

function GameDetails({
  gameId,
  view,
  selectedCardIds,
  onToggleCard,
  onAction,
  actionPending,
  actionError,
}: {
  gameId: string;
  view: GameView;
  selectedCardIds: string[];
  onToggleCard: (cardId: string) => void;
  onAction: (command: PlayerCommand) => void;
  actionPending: boolean;
  actionError: string | null;
}) {
  const interaction = view.status === 'active' ? view.interaction : null;
  const canSelect = interaction?.kind === 'turn' || interaction?.kind === 'damage-discard';

  return (
    <section aria-label="Game details">
      <p>
        <strong>Game ID:</strong> <code>{gameId}</code>
      </p>
      {view.status === 'active' || view.result === 'loss' ? (
        <>
          {view.status === 'game-over' && <h2>Defeat</h2>}
          <h2>Current enemy: {cardLabel(view.battle.enemy)}</h2>
          <dl>
            <dt>Enemy rank</dt>
            <dd>{view.battle.enemy.rank}</dd>
            <dt>Enemy suit</dt>
            <dd>{view.battle.enemy.suit}</dd>
            <dt>Damage dealt / enemy health</dt>
            <dd>
              {view.battle.damageDealt} / {view.battle.enemyHealth}
            </dd>
            <dt>Enemy attack</dt>
            <dd>{view.battle.enemyAttack}</dd>
            <dt>Shield</dt>
            <dd>{view.battle.shield}</dd>
            {interaction && (
              <>
                <dt>Current interaction</dt>
                <dd>{interaction.kind}</dd>
              </>
            )}
          </dl>
        </>
      ) : (
        <h2>Victory{view.soloVictoryRank && ` - ${view.soloVictoryRank}`}</h2>
      )}
      <h2>Your hand</h2>
      {view.viewer.hand.length > 0 ? (
        <ul className="flex flex-wrap gap-2 p-0 list-none">
          {view.viewer.hand.map((card) => (
            <li key={card.id}>
              {canSelect ? (
                <button
                  type="button"
                  aria-pressed={selectedCardIds.includes(card.id)}
                  disabled={actionPending}
                  onClick={() => onToggleCard(card.id)}
                  className={`cursor-pointer rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    selectedCardIds.includes(card.id)
                      ? 'border-blue-700 bg-blue-100 ring-2 ring-blue-700'
                      : 'border-slate-500 bg-white hover:bg-slate-100'
                  }`}
                >
                  {cardLabel(card)}
                </button>
              ) : (
                <span className="inline-block rounded border border-slate-400 px-3 py-2">
                  {cardLabel(card)}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No cards in hand.</p>
      )}
      {interaction && (
        <section aria-label="Interaction" className="my-6">
          <InteractionControls
            interaction={interaction}
            selectedCardIds={selectedCardIds}
            actionPending={actionPending}
            onAction={onAction}
          />
          {actionError && (
            <p role="alert" className="text-red-700">
              {actionError}
            </p>
          )}
        </section>
      )}
      <h2>Card piles</h2>
      <dl>
        <dt>Tavern remaining</dt>
        <dd>{view.tavern.remainingCards}</dd>
        <dt>Castle remaining</dt>
        <dd>{view.castle.remainingCards}</dd>
        <dt>Discard cards</dt>
        <dd>{view.discard.cards.length}</dd>
      </dl>
    </section>
  );
}

function InteractionControls({
  interaction,
  selectedCardIds,
  actionPending,
  onAction,
}: {
  interaction: Interaction;
  selectedCardIds: string[];
  actionPending: boolean;
  onAction: (command: PlayerCommand) => void;
}) {
  switch (interaction.kind) {
    case 'turn':
      return (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={actionButtonClass}
              disabled={actionPending || selectedCardIds.length === 0}
              onClick={() => onAction({ kind: 'play-cards', cardIds: selectedCardIds })}
            >
              Play selected cards
            </button>
            {interaction.canYield && (
              <button
                type="button"
                className={actionButtonClass}
                disabled={actionPending}
                onClick={() => onAction({ kind: 'yield' })}
              >
                Yield
              </button>
            )}
            {interaction.canUseSoloJester && (
              <button
                type="button"
                className={actionButtonClass}
                disabled={actionPending}
                onClick={() => onAction({ kind: 'use-solo-jester' })}
              >
                Use Solo Jester
              </button>
            )}
          </div>
          {actionPending && <p>Submitting action...</p>}
        </>
      );
    case 'solo-retaliation':
      return (
        <>
          <p>Before taking damage, choose whether to use a Solo Jester.</p>
          <div className="flex flex-wrap gap-2">
            {interaction.canUseSoloJester && (
              <button
                type="button"
                className={actionButtonClass}
                disabled={actionPending}
                onClick={() => onAction({ kind: 'use-solo-jester' })}
              >
                Use Solo Jester
              </button>
            )}
            <button
              type="button"
              className={actionButtonClass}
              disabled={actionPending}
              onClick={() => onAction({ kind: 'decline-solo-jester' })}
            >
              Continue without Jester
            </button>
          </div>
          {actionPending && <p>Submitting action...</p>}
        </>
      );
    case 'damage-discard':
      return (
        <>
          <p>Discard cards to absorb {interaction.requiredDamage} damage.</p>
          <button
            type="button"
            className={actionButtonClass}
            disabled={actionPending || selectedCardIds.length === 0}
            onClick={() => onAction({ kind: 'discard-for-damage', cardIds: selectedCardIds })}
          >
            Discard selected cards
          </button>
          {actionPending && <p>Submitting action...</p>}
        </>
      );
    case 'waiting':
      return <p>Waiting for another player.</p>;
    case 'choose-next-player':
      return <p>Choosing the next player is not supported by the solo UI yet.</p>;
  }
}

export default App;
