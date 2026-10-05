import type {
  Action,
  Battle,
  Card,
  Decision,
  DiscardForDamage,
  EnemyRank,
  GameState,
  NumberCard,
  PlayCards,
  Player,
  RoyalCard,
  World,
} from './game-engine.types.ts';

export function transition(state: GameState, action: Action): GameState {
  const { world, decision } = state;
  if (action.playerId !== world.currentPlayer) {
    throw new Error('Only the current player can act');
  }
  const player = world.players.find((candidate) => candidate.id === world.currentPlayer);
  if (!player) throw new Error('The current player is not in the game');

  switch (decision.kind) {
    case 'await-turn-action':
      if (action.kind !== 'play-cards') throw new Error('Not awaiting a turn play');
      return handleTurnAction(world, player, action);
    case 'await-damage-discard':
      if (action.kind !== 'discard-for-damage') throw new Error('Not awaiting a damage discard');
      return handleDamageDiscard(world, player, decision, action);
  }

  return assertNever(decision);
}

function handleTurnAction(world: World, player: Player, action: PlayCards): GameState {
  const card = validatePlay(player, action);
  validateSupportedBattle(world.battle);
  const worldAfterPlay = applyPlay(world, player, card);
  return resolveAfterPlay(worldAfterPlay, card);
}

function handleDamageDiscard(
  world: World,
  player: Player,
  decision: Extract<Decision, { kind: 'await-damage-discard' }>,
  action: DiscardForDamage,
): GameState {
  const selected = selectedCardsFromHand(player.hand, action.cardIds);
  if (selected.reduce((total, card) => total + cardValue(card), 0) < decision.requiredDamage) {
    throw new Error('Selected cards do not absorb enough damage');
  }

  const discardedIds = new Set(action.cardIds);
  return {
    world: {
      ...world,
      players: world.players.map((candidate) =>
        candidate.id === player.id
          ? { ...candidate, hand: candidate.hand.filter((card) => !discardedIds.has(card.id)) }
          : candidate,
      ),
      currentPlayer: nextPlayer(world),
      discard: [...world.discard, ...selected],
    },
    decision: { kind: 'await-turn-action' },
  };
}

function validatePlay(player: Player, action: PlayCards): NumberCard {
  if (action.cardIds.length !== 1) throw new Error('Only single-card plays are supported');
  const [card] = selectedCardsFromHand(player.hand, action.cardIds);
  if (!card || card.kind !== 'number' || card.suit !== 'clubs') {
    throw new Error('Only numbered Clubs plays are supported');
  }
  return card;
}

function validateSupportedBattle(battle: Battle): void {
  if (
    battle.enemy.rank !== 'jack' ||
    battle.enemy.suit !== 'hearts' ||
    battle.playedCards.some((played) => played.suit === 'spades')
  ) {
    throw new Error('Only unshielded Jack of Hearts battles are supported');
  }
}

function applyPlay(world: World, player: Player, card: NumberCard): World {
  return {
    ...world,
    players: world.players.map((candidate) =>
      candidate.id === player.id
        ? { ...candidate, hand: candidate.hand.filter((held) => held.id !== card.id) }
        : candidate,
    ),
    battle: { ...world.battle, playedCards: [...world.battle.playedCards, card] },
  };
}

function resolveAfterPlay(world: World, card: NumberCard): GameState {
  const { battle } = world;
  const damageDealt = battle.damageDealt + card.rank * 2;
  if (damageDealt > enemyHealth(battle.enemy)) {
    return resolveEnemyDefeat(world);
  }
  if (damageDealt === enemyHealth(battle.enemy)) {
    throw new Error('Unsupported game outcome: exact-damage enemy defeat');
  }

  const requiredDamage = enemyAttack(battle.enemy);
  const player = world.players.find((candidate) => candidate.id === world.currentPlayer);
  if (!player) throw new Error('The current player is not in the game');
  if (requiredDamage > player.hand.reduce((total, held) => total + cardValue(held), 0)) {
    throw new Error('Unsupported game outcome: unsurvivable attack');
  }

  return {
    world: { ...world, battle: { ...battle, damageDealt } },
    decision: { kind: 'await-damage-discard', requiredDamage },
  };
}

function resolveEnemyDefeat(world: World): GameState {
  const nextEnemy = world.castle[0];
  if (!nextEnemy) throw new Error('Unsupported game outcome: final enemy defeat');

  return {
    world: {
      ...world,
      discard: [...world.discard, world.battle.enemy, ...world.battle.playedCards],
      castle: world.castle.slice(1),
      battle: {
        enemy: nextEnemy,
        damageDealt: 0,
        playedCards: [],
        immunityCancelled: false,
      },
    },
    decision: { kind: 'await-turn-action' },
  };
}

function selectedCardsFromHand(hand: readonly Card[], cardIds: readonly string[]): Card[] {
  if (cardIds.length === 0 || new Set(cardIds).size !== cardIds.length) {
    throw new Error("Select distinct cards from the current player's hand");
  }

  return cardIds.map((id) => {
    const card = hand.find((candidate) => candidate.id === id);
    if (!card) throw new Error(`Card ${id} is not in the current player's hand`);
    return card;
  });
}

function cardValue(card: Card): number {
  return card.kind === 'number' ? card.rank : royalCardValue(card);
}

function royalCardValue(card: RoyalCard): number {
  return ROYAL_RANK_DATA[card.rank].value;
}

function enemyAttack(enemy: RoyalCard): number {
  return ROYAL_RANK_DATA[enemy.rank].value;
}

function enemyHealth(enemy: RoyalCard): number {
  return ROYAL_RANK_DATA[enemy.rank].health;
}

function nextPlayer(world: World): string {
  const index = world.players.findIndex((player) => player.id === world.currentPlayer);
  const next = world.players[(index + 1) % world.players.length];
  if (!next) throw new Error('There must be a next player');
  return next.id;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported decision: ${JSON.stringify(value)}`);
}

const ROYAL_RANK_DATA = {
  jack: { value: 10, health: 20 },
  queen: { value: 15, health: 30 },
  king: { value: 20, health: 40 },
} as const satisfies Record<EnemyRank, { readonly value: number; readonly health: number }>;
