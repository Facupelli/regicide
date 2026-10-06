import {
  battleStats,
  canUseSoloJester,
  canYield,
  soloVictoryRank,
  type GameState,
} from '@regicide/game-engine';
import type {
  BattleView,
  Card,
  GameView,
  HistoricalPlayView,
  Interaction,
} from '@regicide/protocol';

type ActiveState = Extract<GameState, { kind: 'active' }>;
type BattleState = Exclude<GameState, { kind: 'game-over'; result: 'win' }>;
type EngineCard = ActiveState['world']['players'][number]['hand'][number];
type EnginePlay = ActiveState['world']['battle']['plays'][number];

export function toGameView(state: GameState, viewerId: string): GameView {
  const { world } = state;
  const viewer = world.players.find((player) => player.id === viewerId);
  if (!viewer) throw new Error(`Viewer ${viewerId} is not in the game`);

  // Construct an allowlist, never spread the authoritative world into a response.
  const publicFields = {
    players: world.players.map((player) => ({ id: player.id, handSize: player.hand.length })),
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

function toProtocolCard(
  card: Extract<EngineCard, { kind: 'royal' }>,
): Extract<Card, { kind: 'royal' }>;
function toProtocolCard(
  card: Extract<EngineCard, { kind: 'jester' }>,
): Extract<Card, { kind: 'jester' }>;
function toProtocolCard(
  card: Exclude<EngineCard, { kind: 'jester' }>,
): Exclude<Card, { kind: 'jester' }>;
function toProtocolCard(card: EngineCard): Card;
function toProtocolCard(card: EngineCard): Card {
  switch (card.kind) {
    case 'number':
      return { kind: 'number', id: card.id, rank: card.rank, suit: card.suit };
    case 'animal':
      return { kind: 'animal', id: card.id, suit: card.suit };
    case 'royal':
      return { kind: 'royal', id: card.id, rank: card.rank, suit: card.suit };
    case 'jester':
      return { kind: 'jester', id: card.id };
  }
  return assertNever(card);
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
  if (viewerId !== state.world.currentPlayer) return { kind: 'waiting' };

  switch (state.decision.kind) {
    case 'await-turn-action':
      return { kind: 'turn', canYield: canYield(state), canUseSoloJester: canUseSoloJester(state) };
    case 'await-damage-discard':
      return { kind: 'damage-discard', requiredDamage: state.decision.requiredDamage };
    case 'await-next-player-choice':
      return {
        kind: 'choose-next-player',
        eligiblePlayerIds: state.world.players.map((player) => player.id),
      };
    case 'await-solo-retaliation':
      return { kind: 'solo-retaliation', canUseSoloJester: canUseSoloJester(state) };
  }
  return assertNever(state.decision);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported engine state: ${JSON.stringify(value)}`);
}
