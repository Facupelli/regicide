import type {
  Action,
  Battle,
  Card,
  ChooseNextPlayer,
  Decision,
  DiscardForDamage,
  EnemyRank,
  GameState,
  JesterCard,
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
    case 'await-next-player-choice':
      if (action.kind !== 'choose-next-player')
        throw new Error('Not awaiting a next player choice');
      return handleNextPlayerChoice(world, action);
  }

  return assertNever(decision);
}

function handleTurnAction(world: World, player: Player, action: PlayCards): GameState {
  const card = validatePlay(player, action);
  validateSupportedBattle(world.battle);
  const worldAfterPlay = applyPlay(world, player, card);
  if (card.kind === 'jester') {
    return {
      world: {
        ...worldAfterPlay,
        battle: { ...worldAfterPlay.battle, immunityCancelled: true },
      },
      decision: { kind: 'await-next-player-choice' },
    };
  }
  const worldAfterSuitPower = resolveImmediateSuitPower(worldAfterPlay, card);
  return resolveAfterPlay(worldAfterSuitPower, card);
}

function handleNextPlayerChoice(world: World, action: ChooseNextPlayer): GameState {
  if (!world.players.some((player) => player.id === action.targetPlayerId)) {
    throw new Error('The chosen player is not in the game');
  }
  return {
    world: { ...world, currentPlayer: action.targetPlayerId },
    decision: { kind: 'await-turn-action' },
  };
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

function validatePlay(player: Player, action: PlayCards): NumberCard | JesterCard {
  if (action.cardIds.length !== 1) throw new Error('Only single-card plays are supported');
  const [card] = selectedCardsFromHand(player.hand, action.cardIds);
  if (!card || card.kind === 'royal') {
    throw new Error('Only single numbered card or Jester plays are supported');
  }
  return card;
}

function validateSupportedBattle(battle: Battle): void {
  if (battle.enemy.rank !== 'jack') {
    throw new Error('Only Jack battles are supported');
  }
}

function applyPlay(world: World, player: Player, card: NumberCard | JesterCard): World {
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

function resolveImmediateSuitPower(world: World, card: NumberCard): World {
  if (!suitPowerActive(world.battle, card)) return world;
  if (card.suit === 'hearts') return resolveHeartHeal(world, attackValue(card));
  if (card.suit === 'diamonds') return resolveDiamondDraw(world, attackValue(card));
  return world;
}

function resolveHeartHeal(world: World, healCount: number): World {
  const { cards, rngState } = shuffle(world.discard, world.rngState);
  const healed = Math.min(healCount, cards.length);
  return {
    ...world,
    discard: cards.slice(healed),
    tavern: [...world.tavern, ...cards.slice(0, healed)],
    rngState,
  };
}

// Fisher-Yates on a copy; the LCG state is part of the world, never global.
function shuffle(cards: readonly Card[], rngState: number): { cards: Card[]; rngState: number } {
  const shuffled = [...cards];
  let nextState = rngState;
  for (let index = shuffled.length - 1; index > 0; index--) {
    nextState = (Math.imul(nextState, 1664525) + 1013904223) >>> 0;
    const otherIndex = Math.floor((nextState / 0x100000000) * (index + 1));
    const card = shuffled[index]!;
    shuffled[index] = shuffled[otherIndex]!;
    shuffled[otherIndex] = card;
  }
  return { cards: shuffled, rngState: nextState };
}

function resolveDiamondDraw(world: World, drawCount: number): World {
  const handLimit = maxHandSize(world.players.length);
  const players: Player[] = world.players.map((player) => ({ ...player, hand: [...player.hand] }));
  let playerIndex = players.findIndex((player) => player.id === world.currentPlayer);
  if (playerIndex < 0) throw new Error('The current player is not in the game');
  let drawn = 0;

  while (
    drawn < drawCount &&
    drawn < world.tavern.length &&
    players.some((player) => player.hand.length < handLimit)
  ) {
    const player = players[playerIndex];
    if (!player) throw new Error('The drawing player is not in the game');
    if (player.hand.length < handLimit) {
      const card = world.tavern[drawn];
      if (!card) throw new Error('The Tavern has no card to draw');
      players[playerIndex] = { ...player, hand: [...player.hand, card] };
      drawn++;
    }
    playerIndex = (playerIndex + 1) % players.length;
  }

  return { ...world, players, tavern: world.tavern.slice(drawn) };
}

function maxHandSize(playerCount: number): number {
  const limit = HAND_LIMITS[playerCount - 1];
  if (!limit) throw new Error('Only games with 1 to 4 players are supported');
  return limit;
}

function resolveAfterPlay(world: World, card: NumberCard): GameState {
  const { battle } = world;
  const damageDealt = battle.damageDealt + attackDamage(battle, card);
  if (damageDealt > enemyHealth(battle.enemy)) {
    return resolveEnemyDefeat(world, 'overkill');
  }
  if (damageDealt === enemyHealth(battle.enemy)) {
    return resolveEnemyDefeat(world, 'exact');
  }

  const requiredDamage = Math.max(0, enemyAttack(battle.enemy) - activeShield(battle));
  const worldAfterDamage = { ...world, battle: { ...battle, damageDealt } };
  if (requiredDamage === 0) {
    return {
      world: { ...worldAfterDamage, currentPlayer: nextPlayer(worldAfterDamage) },
      decision: { kind: 'await-turn-action' },
    };
  }

  const player = world.players.find((candidate) => candidate.id === world.currentPlayer);
  if (!player) throw new Error('The current player is not in the game');
  if (requiredDamage > player.hand.reduce((total, held) => total + cardValue(held), 0)) {
    throw new Error('Unsupported game outcome: unsurvivable attack');
  }

  return {
    world: worldAfterDamage,
    decision: { kind: 'await-damage-discard', requiredDamage },
  };
}

type DefeatKind = 'overkill' | 'exact';

function resolveEnemyDefeat(world: World, defeatKind: DefeatKind): GameState {
  const nextEnemy = world.castle[0];
  if (!nextEnemy) throw new Error('Unsupported game outcome: final enemy defeat');

  return {
    world: {
      ...world,
      tavern: defeatKind === 'exact' ? [world.battle.enemy, ...world.tavern] : world.tavern,
      discard: [
        ...world.discard,
        ...(defeatKind === 'overkill' ? [world.battle.enemy] : []),
        ...world.battle.playedCards,
      ],
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

function attackValue(card: NumberCard | JesterCard): number {
  return card.kind === 'jester' ? 0 : card.rank;
}

function attackDamage(battle: Battle, card: NumberCard): number {
  const value = attackValue(card);
  return card.suit === 'clubs' && suitPowerActive(battle, card) ? value * 2 : value;
}

function suitPowerActive(battle: Battle, card: NumberCard | RoyalCard): boolean {
  return card.suit !== battle.enemy.suit || battle.immunityCancelled;
}

function activeShield(battle: Battle): number {
  return battle.playedCards.reduce(
    (total, card) =>
      total +
      (card.kind !== 'jester' && card.suit === 'spades' && suitPowerActive(battle, card)
        ? cardValue(card)
        : 0),
    0,
  );
}

function cardValue(card: Card): number {
  return card.kind === 'royal' ? royalCardValue(card) : attackValue(card);
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

const HAND_LIMITS = [8, 7, 6, 5] as const;

const ROYAL_RANK_DATA = {
  jack: { value: 10, health: 20 },
  queen: { value: 15, health: 30 },
  king: { value: 20, health: 40 },
} as const satisfies Record<EnemyRank, { readonly value: number; readonly health: number }>;
