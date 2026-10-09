import {
  battleStats,
  canAcceptDefeat,
  canUseSoloJester,
  canYield,
  soloVictoryRank,
  type GameState,
} from '@regicide/game-engine';
import type { BattleView, GameView, HistoricalPlayView, Interaction } from '@regicide/protocol';
import type { SessionPlayer } from '../game-session.ts';
import { toProtocolCard } from './card.ts';

type ActiveState = Extract<GameState, { kind: 'active' }>;
type BattleState = Exclude<GameState, { kind: 'game-over'; result: 'win' }>;
type EnginePlay = ActiveState['world']['battle']['plays'][number];

export function toGameView(
  state: GameState,
  viewerId: string,
  sessionPlayers: readonly SessionPlayer[],
): GameView {
  const { world } = state;
  const viewer = world.players.find((player) => player.id === viewerId);
  if (!viewer) {
    throw new Error(`Viewer ${viewerId} is not in the game`);
  }

  // Construct an allowlist, never spread the authoritative world into a response.
  const publicFields = {
    players: world.players.map((player) => {
      const slot = sessionPlayers.find((entry) => entry.id === player.id);
      if (!slot) {
        throw new Error(`Player ${player.id} has no session slot`);
      }
      return slot.controller === 'agent'
        ? {
            id: player.id,
            controller: 'agent' as const,
            model: slot.model,
            handSize: player.hand.length,
          }
        : { id: player.id, controller: 'human' as const, handSize: player.hand.length };
    }),
    viewer: { id: viewer.id, hand: viewer.hand.map(toProtocolCard) },
    tavern: { remainingCards: world.tavern.length },
    discard: { cards: world.discard.map(toProtocolCard) },
    castle: { remainingCards: world.castle.length },
    soloJestersRemaining: world.soloJestersUsed === null ? null : 2 - world.soloJestersUsed,
  };

  if (state.kind === 'active') {
    return {
      status: 'active',
      ...publicFields,
      currentPlayerId: world.currentPlayer,
      battle: toBattleView(state),
      interaction: toInteraction(state, viewerId),
    };
  }
  if (state.result === 'loss') {
    return { status: 'game-over', result: 'loss', ...publicFields, battle: toBattleView(state) };
  }
  return {
    status: 'game-over',
    result: 'win',
    ...publicFields,
    soloVictoryRank: soloVictoryRank(state),
  };
}

function toBattleView(state: BattleState): BattleView {
  const { battle } = state.world;
  return {
    enemy: toProtocolCard(battle.enemy),
    damageDealt: battle.damageDealt,
    ...battleStats(state),
    plays: battle.plays.map(toHistoricalPlayView),
  };
}

function toHistoricalPlayView(play: EnginePlay): HistoricalPlayView {
  switch (play.kind) {
    case 'attack':
      return { kind: 'attack', cards: play.cards.map((card) => toProtocolCard(card)) };
    case 'jester':
      return { kind: 'jester', card: toProtocolCard(play.card) };
  }
  return assertNever(play);
}

function toInteraction(state: ActiveState, viewerId: string): Interaction {
  if (viewerId !== state.world.currentPlayer) {
    return { kind: 'waiting' };
  }

  switch (state.decision.kind) {
    case 'await-turn-action':
      return { kind: 'turn', canYield: canYield(state), canUseSoloJester: canUseSoloJester(state) };
    case 'await-retaliation-action':
      return {
        kind: 'damage-discard',
        requiredDamage: state.decision.requiredDamage,
        canUseSoloJester: canUseSoloJester(state),
        canAcceptDefeat: canAcceptDefeat(state),
      };
    case 'await-next-player-choice':
      return {
        kind: 'choose-next-player',
        eligiblePlayerIds: state.world.players.map((player) => player.id),
      };
  }
  return assertNever(state.decision);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported engine state: ${JSON.stringify(value)}`);
}
