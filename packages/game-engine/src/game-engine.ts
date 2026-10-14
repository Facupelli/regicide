import type {
  AcceptDefeat,
  Action,
  AttackCard,
  AttackPlay,
  Battle,
  Card,
  ChooseNextPlayer,
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

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}

export type TransitionOutcome = Readonly<{
  state: GameState;
  diamondDrawRecipientIds: readonly string[];
}>;

export function transition(state: GameState, action: Action): GameState {
  return transitionWithOutcome(state, action).state;
}

export function transitionWithOutcome(state: GameState, action: Action): TransitionOutcome {
  const diamondDrawRecipientIds: string[] = [];
  const nextState = transitionCore(state, action, diamondDrawRecipientIds);
  return { state: nextState, diamondDrawRecipientIds };
}

function transitionCore(
  state: GameState,
  action: Action,
  diamondDrawRecipientIds: string[],
): GameState {
  if (state.kind === 'game-over') {
    throw new IllegalActionError('The game is over');
  }

  const { world, decision } = state;
  const player = world.players.find((candidate) => candidate.id === world.currentPlayer);
  if (!player) {
    throw new Error('The current player is not in the game');
  }
  if (action.playerId !== world.currentPlayer) {
    throw new IllegalActionError('Only the current player can act');
  }

  switch (decision.kind) {
    case 'await-turn-action':
      if (
        action.kind !== 'play-cards' &&
        action.kind !== 'yield' &&
        action.kind !== 'use-solo-jester'
      )
        throw new IllegalActionError(
          `Action ${action.kind} is not valid while awaiting a turn action`,
        );
      return handleTurnAction(world, player, action, diamondDrawRecipientIds);
    case 'await-retaliation-action':
      if (
        action.kind !== 'discard-for-damage' &&
        action.kind !== 'use-solo-jester' &&
        action.kind !== 'accept-defeat'
      )
        throw new IllegalActionError(`Action ${action.kind} is not valid during retaliation`);
      return handleRetaliationAction(world, player, decision, action);
    case 'await-next-player-choice':
      if (action.kind !== 'choose-next-player')
        throw new IllegalActionError(
          `Action ${action.kind} is not valid while awaiting a next-player choice`,
        );
      return handleNextPlayerChoice(world, action);
  }

  return assertNever(decision);
}

function handleTurnAction(
  world: World,
  player: Player,
  action: PlayCards | YieldTurn | UseSoloJester,
  diamondDrawRecipientIds: string[],
): GameState {
  if (action.kind === 'use-solo-jester') {
    return enterTurn(replaceSoloHand(world, player));
  }

  if (action.kind === 'yield') {
    if (!isYieldAllowedByStreak(world)) {
      throw new IllegalActionError('Every other player yielded on their previous turn');
    }
    return resolveRetaliation({ ...world, consecutiveYields: world.consecutiveYields + 1 });
  }

  const play = validatePlay(player, action);
  const worldAfterPlay = applyPlay(world, player, play);
  switch (play.kind) {
    case 'jester':
      return {
        kind: 'active',
        world: worldAfterPlay,
        decision: { kind: 'await-next-player-choice' },
      };
    case 'attack':
      return resolveAfterPlay(
        resolveImmediateSuitPower(worldAfterPlay, play, diamondDrawRecipientIds),
        play,
      );
  }
  return assertNever(play);
}

function replaceSoloHand(world: World, player: Player): World {
  if (!hasSoloJester(world)) throw new IllegalActionError('No solo Jester available');
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
    throw new IllegalActionError('The chosen player is not in the game');
  }
  return enterTurn({ ...world, currentPlayer: action.targetPlayerId });
}

function handleRetaliationAction(
  world: World,
  player: Player,
  decision: Extract<Decision, { kind: 'await-retaliation-action' }>,
  action: DiscardForDamage | UseSoloJester | AcceptDefeat,
): GameState {
  if (action.kind === 'use-solo-jester') return resolveRetaliation(replaceSoloHand(world, player));
  if (action.kind === 'accept-defeat') {
    if (!canAcceptDefeatForPlayer(world, player, decision.requiredDamage)) {
      throw new IllegalActionError(
        'Defeat can only be accepted when a Jester is the only survival action',
      );
    }
    return { kind: 'game-over', world, result: 'loss' };
  }

  if (decision.requiredDamage === 0) {
    if (action.cardIds.length > 0)
      throw new IllegalActionError('No cards need to be discarded for zero damage');
    return enterTurn({ ...world, currentPlayer: nextPlayer(world) });
  }
  const selected = selectedCardsFromHand(player.hand, action.cardIds);
  if (
    selected.reduce((total, card) => total + damageDiscardValue(card), 0) < decision.requiredDamage
  ) {
    throw new IllegalActionError('Selected cards do not absorb enough damage');
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

function isYieldAllowedByStreak(world: World): boolean {
  return world.consecutiveYields < world.players.length - 1;
}

export function canYield(state: Extract<GameState, { kind: 'active' }>): boolean {
  return state.decision.kind === 'await-turn-action' && isYieldAllowedByStreak(state.world);
}

export function canUseSoloJester(state: Extract<GameState, { kind: 'active' }>): boolean {
  return (
    (state.decision.kind === 'await-turn-action' ||
      state.decision.kind === 'await-retaliation-action') &&
    hasSoloJester(state.world)
  );
}

function hasLegalCardPlay(player: Player): boolean {
  // Every card currently supported in a player's hand can be played alone.
  return player.hand.length > 0;
}

function enterTurn(world: World): GameState {
  const player = world.players.find((candidate) => candidate.id === world.currentPlayer);
  if (!player) throw new Error('The current player is not in the game');
  if (!isYieldAllowedByStreak(world) && !hasLegalCardPlay(player) && !hasSoloJester(world)) {
    return { kind: 'game-over', world, result: 'loss' };
  }
  return { kind: 'active', world, decision: { kind: 'await-turn-action' } };
}

export type PlayValidation =
  | Readonly<{ kind: 'valid'; play: HistoricalPlay }>
  | Readonly<{
      kind: 'invalid';
      reason:
        | 'empty'
        | 'duplicate'
        | 'too-many'
        | 'jester-pair'
        | 'animal-pair'
        | 'combo-too-large'
        | 'combo-mixed-ranks'
        | 'unsupported-pair';
    }>;

/** Checks whether these cards form a legal play, independent of turn ownership and game state. */
export function validateCardPlay(cards: readonly Card[]): PlayValidation {
  if (cards.length === 0) return { kind: 'invalid', reason: 'empty' };
  if (new Set(cards.map((card) => card.id)).size !== cards.length) {
    return { kind: 'invalid', reason: 'duplicate' };
  }
  if (cards.length > 4) return { kind: 'invalid', reason: 'too-many' };
  if (cards.length === 1) {
    const [card] = cards;
    if (card) return { kind: 'valid', play: validateSinglePlay(card) };
  }

  if (cards.length === 2) {
    const [first, second] = cards;
    if (first && second && isAttackCard(first) && isAttackCard(second)) {
      if (first.kind === 'animal') {
        return { kind: 'valid', play: { kind: 'attack', cards: [first, second] } };
      }
      if (second.kind === 'animal') {
        return { kind: 'valid', play: { kind: 'attack', cards: [first, second] } };
      }
    }
  }
  if (isNumberCombo(cards)) return { kind: 'valid', play: { kind: 'attack', cards } };
  if (cards.some((card) => card.kind === 'jester')) {
    return { kind: 'invalid', reason: 'jester-pair' };
  }
  if (cards.some((card) => card.kind === 'animal')) {
    return { kind: 'invalid', reason: 'animal-pair' };
  }
  const [first] = cards;
  if (first?.kind === 'number' && cards.every((card) => card.kind === 'number')) {
    return {
      kind: 'invalid',
      reason: cards.every((card) => card.rank === first.rank)
        ? 'combo-too-large'
        : 'combo-mixed-ranks',
    };
  }
  return { kind: 'invalid', reason: 'unsupported-pair' };
}

function validatePlay(player: Player, action: PlayCards): HistoricalPlay {
  const result = validateCardPlay(selectedCardsFromHand(player.hand, action.cardIds));
  if (result.kind === 'valid') return result.play;
  switch (result.reason) {
    case 'empty':
      throw new IllegalActionError('Select a card to play');
    case 'duplicate':
      throw new IllegalActionError("Select distinct cards from the current player's hand");
    case 'too-many':
      throw new IllegalActionError('At most four cards can be played together');
    default:
      throw new IllegalActionError(
        'Only Animal Companion pairs or same-rank numbered combos of value 10 or less are supported',
      );
  }
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

function resolveImmediateSuitPower(
  world: World,
  play: AttackPlay,
  diamondDrawRecipientIds: string[],
): World {
  let result = world;
  const suits = playSuits(play);
  const value = playAttackValue(play);
  if (suits.has('hearts') && suitPowerActive(result.battle, 'hearts')) {
    result = resolveHeartHeal(result, value);
  }
  if (suits.has('diamonds') && suitPowerActive(result.battle, 'diamonds')) {
    result = resolveDiamondDraw(result, value, diamondDrawRecipientIds);
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

function resolveDiamondDraw(
  world: World,
  drawCount: number,
  diamondDrawRecipientIds: string[],
): World {
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
      diamondDrawRecipientIds.push(player.id);
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

  return resolveRetaliation({ ...world, battle: { ...battle, damageDealt } });
}

function canAbsorbDamage(player: Player, requiredDamage: number): boolean {
  return player.hand.reduce((total, held) => total + damageDiscardValue(held), 0) >= requiredDamage;
}

function canAcceptDefeatForPlayer(world: World, player: Player, requiredDamage: number): boolean {
  return hasSoloJester(world) && !canAbsorbDamage(player, requiredDamage);
}

export function canAcceptDefeat(state: Extract<GameState, { kind: 'active' }>): boolean {
  if (state.decision.kind !== 'await-retaliation-action') return false;
  const player = state.world.players.find(
    (candidate) => candidate.id === state.world.currentPlayer,
  );
  if (!player) throw new Error('The current player is not in the game');
  return canAcceptDefeatForPlayer(state.world, player, state.decision.requiredDamage);
}

function resolveRetaliation(world: World): GameState {
  const requiredDamage = Math.max(0, enemyAttack(world.battle.enemy) - activeShield(world.battle));
  if (requiredDamage === 0 && !hasSoloJester(world)) {
    return enterTurn({ ...world, currentPlayer: nextPlayer(world) });
  }

  const player = world.players.find((candidate) => candidate.id === world.currentPlayer);
  if (!player) throw new Error('The current player is not in the game');
  if (!canAbsorbDamage(player, requiredDamage) && !hasSoloJester(world)) {
    return { kind: 'game-over', world, result: 'loss' };
  }

  return {
    kind: 'active',
    world,
    decision: { kind: 'await-retaliation-action', requiredDamage },
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
    },
  });
}

function selectedCardsFromHand(hand: readonly Card[], cardIds: readonly string[]): Card[] {
  if (cardIds.length === 0 || new Set(cardIds).size !== cardIds.length) {
    throw new IllegalActionError("Select distinct cards from the current player's hand");
  }

  return cardIds.map((id) => {
    const card = hand.find((candidate) => candidate.id === id);
    if (!card) throw new IllegalActionError(`Card ${id} is not in the current player's hand`);
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
  return suit !== battle.enemy.suit || immunityCancelled(battle);
}

function immunityCancelled(battle: Battle): boolean {
  return battle.plays.some((play) => play.kind === 'jester');
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

export function damageDiscardValue(card: Card): number {
  return attackValue(card);
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

type BattleState = Exclude<GameState, { kind: 'game-over'; result: 'win' }>;

export function battleStats(state: BattleState): Readonly<{
  enemyHealth: number;
  enemyAttack: number;
  shield: number;
  immunityCancelled: boolean;
}> {
  const { battle } = state.world;
  return {
    enemyHealth: enemyHealth(battle.enemy),
    enemyAttack: enemyAttack(battle.enemy),
    shield: activeShield(battle),
    immunityCancelled: immunityCancelled(battle),
  };
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
