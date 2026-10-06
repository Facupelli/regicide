import type {
  Action,
  AttackCard,
  AttackPlay,
  Battle,
  Card,
  ChooseNextPlayer,
  DeclineSoloJester,
  Decision,
  DiscardForDamage,
  EnemyRank,
  GameState,
  HistoricalPlay,
  JesterCard,
  NumberCombo,
  PlayCards,
  Player,
  RoyalCard,
  Suit,
  UseSoloJester,
  World,
  YieldTurn,
} from './game-engine.types.ts';
import { maxHandSize } from './player-count-rules.ts';
import { shuffle } from './shuffle.ts';

export function transition(state: GameState, action: Action): GameState {
  if (state.kind === 'game-over') throw new Error('The game is over');
  const { world, decision } = state;
  if (action.playerId !== world.currentPlayer) {
    throw new Error('Only the current player can act');
  }
  const player = world.players.find((candidate) => candidate.id === world.currentPlayer);
  if (!player) throw new Error('The current player is not in the game');

  switch (decision.kind) {
    case 'await-turn-action':
      if (
        action.kind !== 'play-cards' &&
        action.kind !== 'yield' &&
        action.kind !== 'use-solo-jester'
      )
        throw new Error('Not awaiting a turn action');
      return handleTurnAction(world, player, action);
    case 'await-solo-retaliation':
      if (action.kind !== 'use-solo-jester' && action.kind !== 'decline-solo-jester')
        throw new Error('Not awaiting a solo retaliation choice');
      return handleSoloRetaliation(world, player, action);
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

function handleTurnAction(
  world: World,
  player: Player,
  action: PlayCards | YieldTurn | UseSoloJester,
): GameState {
  if (action.kind === 'use-solo-jester') {
    return enterTurn(replaceSoloHand(world, player));
  }
  if (action.kind === 'yield') {
    if (!canYield(world)) {
      throw new Error('Every other player yielded on their previous turn');
    }
    return startRetaliation({ ...world, consecutiveYields: world.consecutiveYields + 1 });
  }

  const play = validatePlay(player, action);
  const worldAfterPlay = applyPlay(world, player, play);
  switch (play.kind) {
    case 'jester':
      return {
        kind: 'active',
        world: {
          ...worldAfterPlay,
          battle: { ...worldAfterPlay.battle, immunityCancelled: true },
        },
        decision: { kind: 'await-next-player-choice' },
      };
    case 'attack':
      return resolveAfterPlay(resolveImmediateSuitPower(worldAfterPlay, play), play);
  }
  return assertNever(play);
}

function handleSoloRetaliation(
  world: World,
  player: Player,
  action: UseSoloJester | DeclineSoloJester,
): GameState {
  if (action.kind === 'decline-solo-jester') return resolveRetaliation(world);
  return startRetaliation(replaceSoloHand(world, player));
}

function replaceSoloHand(world: World, player: Player): World {
  if (!hasSoloJester(world)) throw new Error('No solo Jester available');
  const drawCount = Math.min(maxHandSize(world.players.length), world.tavern.length);
  return {
    ...world,
    soloJestersUsed: world.soloJestersUsed === 0 ? 1 : 2,
    players: world.players.map((candidate) =>
      candidate.id === player.id
        ? { ...candidate, hand: world.tavern.slice(0, drawCount) }
        : candidate,
    ),
    discard: [...world.discard, ...player.hand],
    tavern: world.tavern.slice(drawCount),
  };
}

function hasSoloJester(world: World): boolean {
  return world.players.length === 1 && world.soloJestersUsed !== null && world.soloJestersUsed < 2;
}

function handleNextPlayerChoice(world: World, action: ChooseNextPlayer): GameState {
  if (!world.players.some((player) => player.id === action.targetPlayerId)) {
    throw new Error('The chosen player is not in the game');
  }
  return enterTurn({ ...world, currentPlayer: action.targetPlayerId });
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
  return enterTurn({
    ...world,
    players: world.players.map((candidate) =>
      candidate.id === player.id
        ? { ...candidate, hand: candidate.hand.filter((card) => !discardedIds.has(card.id)) }
        : candidate,
    ),
    currentPlayer: nextPlayer(world),
    discard: [...world.discard, ...selected],
  });
}

function canYield(world: World): boolean {
  return world.consecutiveYields < world.players.length - 1;
}

function hasLegalCardPlay(player: Player): boolean {
  // Every card currently supported in a player's hand can be played alone.
  return player.hand.length > 0;
}

function enterTurn(world: World): GameState {
  const player = world.players.find((candidate) => candidate.id === world.currentPlayer);
  if (!player) throw new Error('The current player is not in the game');
  if (!canYield(world) && !hasLegalCardPlay(player) && !hasSoloJester(world)) {
    return { kind: 'game-over', world, result: 'loss' };
  }
  return { kind: 'active', world, decision: { kind: 'await-turn-action' } };
}

function validatePlay(player: Player, action: PlayCards): HistoricalPlay {
  if (action.cardIds.length > 4) throw new Error('At most four cards can be played together');
  const cards = selectedCardsFromHand(player.hand, action.cardIds);
  if (cards.length === 1) {
    const [card] = cards;
    if (!card) throw new Error('Select a card to play');
    return validateSinglePlay(card);
  }
  return validateMultiCardPlay(cards);
}

function validateSinglePlay(card: Card): HistoricalPlay {
  switch (card.kind) {
    case 'number':
    case 'animal':
    case 'royal':
      return { kind: 'attack', cards: [card] };
    case 'jester':
      return { kind: 'jester', card };
  }
  return assertNever(card);
}

function validateMultiCardPlay(cards: readonly Card[]): AttackPlay {
  if (cards.length === 2) {
    const [first, second] = cards;
    if (first && second && isAttackCard(first) && isAttackCard(second)) {
      if (first.kind === 'animal') return { kind: 'attack', cards: [first, second] };
      if (second.kind === 'animal') return { kind: 'attack', cards: [first, second] };
    }
  }
  if (isNumberCombo(cards)) return { kind: 'attack', cards };
  throw new Error(
    'Only Animal Companion pairs or same-rank numbered combos of value 10 or less are supported',
  );
}

function isNumberCombo(cards: readonly Card[]): cards is NumberCombo {
  const [first] = cards;
  return (
    cards.length >= 2 &&
    cards.length <= 4 &&
    first?.kind === 'number' &&
    cards.every((card) => card.kind === 'number' && card.rank === first.rank) &&
    first.rank * cards.length <= 10
  );
}

function isAttackCard(card: Card): card is AttackCard {
  return card.kind === 'number' || card.kind === 'animal' || card.kind === 'royal';
}

function applyPlay(world: World, player: Player, play: HistoricalPlay): World {
  const ids = new Set(cardsInPlay(play).map((card) => card.id));
  return {
    ...world,
    players: world.players.map((candidate) =>
      candidate.id === player.id
        ? { ...candidate, hand: candidate.hand.filter((held) => !ids.has(held.id)) }
        : candidate,
    ),
    consecutiveYields: 0,
    battle: { ...world.battle, plays: [...world.battle.plays, play] },
  };
}

function cardsInPlay(play: HistoricalPlay): readonly (AttackCard | JesterCard)[] {
  switch (play.kind) {
    case 'attack':
      return play.cards;
    case 'jester':
      return [play.card];
  }
  return assertNever(play);
}

function playAttackValue(play: AttackPlay): number {
  return play.cards.reduce((total, card) => total + attackValue(card), 0);
}

function playSuits(play: AttackPlay): ReadonlySet<Suit> {
  return new Set(play.cards.map((card) => card.suit));
}

function resolveImmediateSuitPower(world: World, play: AttackPlay): World {
  let result = world;
  const suits = playSuits(play);
  const value = playAttackValue(play);
  if (suits.has('hearts') && suitPowerActive(result.battle, 'hearts')) {
    result = resolveHeartHeal(result, value);
  }
  if (suits.has('diamonds') && suitPowerActive(result.battle, 'diamonds')) {
    result = resolveDiamondDraw(result, value);
  }
  return result;
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

function resolveAfterPlay(world: World, play: AttackPlay): GameState {
  const { battle } = world;
  const damageDealt = battle.damageDealt + attackDamage(battle, play);
  if (damageDealt > enemyHealth(battle.enemy)) {
    return resolveEnemyDefeat(world, 'overkill');
  }
  if (damageDealt === enemyHealth(battle.enemy)) {
    return resolveEnemyDefeat(world, 'exact');
  }

  return startRetaliation({ ...world, battle: { ...battle, damageDealt } });
}

function startRetaliation(world: World): GameState {
  if (hasSoloJester(world)) {
    return { kind: 'active', world, decision: { kind: 'await-solo-retaliation' } };
  }
  return resolveRetaliation(world);
}

function resolveRetaliation(world: World): GameState {
  const requiredDamage = Math.max(0, enemyAttack(world.battle.enemy) - activeShield(world.battle));
  if (requiredDamage === 0) {
    return enterTurn({ ...world, currentPlayer: nextPlayer(world) });
  }

  const player = world.players.find((candidate) => candidate.id === world.currentPlayer);
  if (!player) throw new Error('The current player is not in the game');
  if (requiredDamage > player.hand.reduce((total, held) => total + cardValue(held), 0)) {
    return { kind: 'game-over', world, result: 'loss' };
  }

  return {
    kind: 'active',
    world,
    decision: { kind: 'await-damage-discard', requiredDamage },
  };
}

type DefeatKind = 'overkill' | 'exact';

function resolveEnemyDefeat(world: World, defeatKind: DefeatKind): GameState {
  const { battle, ...rest } = world;
  const resolvedWorld = {
    ...rest,
    tavern: defeatKind === 'exact' ? [battle.enemy, ...world.tavern] : world.tavern,
    discard: [
      ...world.discard,
      ...(defeatKind === 'overkill' ? [battle.enemy] : []),
      ...battle.plays.flatMap(cardsInPlay),
    ],
    castle: world.castle.slice(1),
  };
  const nextEnemy = world.castle[0];
  if (!nextEnemy) {
    if (battle.enemy.rank !== 'king') {
      throw new Error('Unsupported game outcome: final enemy defeat');
    }
    return { kind: 'game-over', world: resolvedWorld, result: 'win' };
  }

  return enterTurn({
    ...resolvedWorld,
    battle: {
      enemy: nextEnemy,
      damageDealt: 0,
      plays: [],
      immunityCancelled: false,
    },
  });
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

function attackValue(card: AttackCard | JesterCard): number {
  if (card.kind === 'jester') return 0;
  if (card.kind === 'animal') return 1;
  if (card.kind === 'royal') return royalCardValue(card);
  return card.rank;
}

function attackDamage(battle: Battle, play: AttackPlay): number {
  const value = playAttackValue(play);
  return playSuits(play).has('clubs') && suitPowerActive(battle, 'clubs') ? value * 2 : value;
}

function suitPowerActive(battle: Battle, suit: Suit): boolean {
  return suit !== battle.enemy.suit || battle.immunityCancelled;
}

function activeShield(battle: Battle): number {
  if (!suitPowerActive(battle, 'spades')) return 0;
  return battle.plays.reduce((total, play) => {
    switch (play.kind) {
      case 'attack':
        return total + (playSuits(play).has('spades') ? playAttackValue(play) : 0);
      case 'jester':
        return total;
    }
    return assertNever(play);
  }, 0);
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

const ROYAL_RANK_DATA = {
  jack: { value: 10, health: 20 },
  queen: { value: 15, health: 30 },
  king: { value: 20, health: 40 },
} as const satisfies Record<EnemyRank, { readonly value: number; readonly health: number }>;
