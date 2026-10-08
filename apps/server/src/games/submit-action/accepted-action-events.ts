import type { Action, Card as EngineCard, GameState } from '@regicide/game-engine';
import type { GameEvent } from '@regicide/protocol';
import { toProtocolCard } from '../protocol/card.ts';

type EventWithoutId = GameEvent extends infer Event
  ? Event extends GameEvent
    ? Omit<Event, 'id'>
    : never
  : never;

export function deriveAcceptedActionEvents(
  previousState: GameState,
  action: Action,
  nextState: GameState,
): EventWithoutId[] {
  const events: EventWithoutId[] = [];
  if (action.kind === 'play-cards') {
    const player = previousState.world.players.find(
      (candidate) => candidate.id === action.playerId,
    );
    if (!player) throw new Error('Accepted play has no authoritative player');
    const played = action.cardIds.map((id) => {
      const card = player.hand.find((candidate) => candidate.id === id);
      if (!card) throw new Error(`Accepted play has no authoritative card: ${id}`);
      return card;
    });
    if (!played.length) throw new Error('Accepted play has no cards');
    events.push({
      type: 'cardsPlayed',
      playerId: action.playerId,
      cards: played.map(toProtocolCard),
    });

    if (!('battle' in previousState.world)) {
      throw new Error('Accepted play has no previous battle');
    }
    const previousBattle = previousState.world.battle;
    const currentEnemy = 'battle' in nextState.world ? nextState.world.battle.enemy : null;
    if (currentEnemy?.id !== previousBattle.enemy.id) {
      const enemy = previousBattle.enemy;
      let destination: 'discard' | 'tavern' | null = null;
      if (nextState.world.tavern[0]?.id === enemy.id) destination = 'tavern';
      else if (nextState.world.discard.some((card) => card.id === enemy.id)) {
        destination = 'discard';
      }
      if (!destination) throw new Error('Defeated enemy has no authoritative destination');
      const battleCards: EngineCard[] = [];
      for (const play of previousBattle.plays) {
        if (play.kind === 'attack') battleCards.push(...play.cards);
        else battleCards.push(play.card);
      }
      const discardedCards = [...battleCards, ...played].map(toProtocolCard);
      events.push({
        type: 'enemyDefeated',
        playerId: action.playerId,
        enemy: toProtocolCard(enemy),
        destination,
        discardedCards,
      });
    }
  }
  if (action.kind === 'discard-for-damage' && action.cardIds.length > 0) {
    // The engine appends the selected cards in discard order. Use its result, not request data.
    const discarded = nextState.world.discard.slice(previousState.world.discard.length);
    if (discarded.length !== action.cardIds.length) {
      throw new Error('Damage discard did not append the expected number of cards');
    }
    const cards = discarded.map(toProtocolCard);
    events.push({
      type: 'cardsDiscardedForDamage',
      playerId: action.playerId,
      cards,
    });
  }
  return events;
}
