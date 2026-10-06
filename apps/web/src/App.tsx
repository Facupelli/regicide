import { useState } from 'react';
import type { Card, GameView } from '@regicide/protocol';
import { ApiClientError, createGame } from './api/games.ts';

type ScreenState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; gameId: string; view: GameView }
  | { status: 'error'; message: string };

function App() {
  const [screen, setScreen] = useState<ScreenState>({ status: 'idle' });

  async function startGame() {
    if (screen.status === 'loading') return;
    setScreen({ status: 'loading' });
    try {
      const { gameId, view } = await createGame();
      setScreen({ status: 'loaded', gameId, view });
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? `${error.message} (${error.code}, HTTP ${error.status})`
          : 'Could not start a game';
      setScreen({ status: 'error', message });
    }
  }

  return (
    <main>
      <h1>Regicide</h1>
      {screen.status === 'loaded' ? (
        <GameDetails gameId={screen.gameId} view={screen.view} />
      ) : (
        <>
          <button type="button" onClick={startGame} disabled={screen.status === 'loading'}>
            {screen.status === 'loading' ? 'Starting game...' : 'Start Solo Game'}
          </button>
          {screen.status === 'error' && <p role="alert">{screen.message}</p>}
        </>
      )}
    </main>
  );
}

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

function GameDetails({ gameId, view }: { gameId: string; view: GameView }) {
  return (
    <section aria-label="Game details">
      <p>
        <strong>Game ID:</strong> <code>{gameId}</code>
      </p>
      {view.status === 'active' ? (
        <>
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
            <dt>Current interaction</dt>
            <dd>{view.interaction.kind}</dd>
          </dl>
        </>
      ) : (
        <h2>Game over: {view.result}</h2>
      )}
      <h2>Your hand</h2>
      {view.viewer.hand.length > 0 ? (
        <ul>
          {view.viewer.hand.map((card) => (
            <li key={card.id}>{cardLabel(card)}</li>
          ))}
        </ul>
      ) : (
        <p>No cards in hand.</p>
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

export default App;
