import type { GameEvent, GameView } from '@regicide/protocol';
import type { PreparedGamePresentation } from './game-presentation.types.ts';

export type PileCounts = Readonly<{ discardCount: number; tavernCount: number }>;
export type DisplayCounts = PileCounts & {
  handCounts: Readonly<Record<string, number>> | null;
};
export type PileMilestone = Readonly<{ key: string; counts: DisplayCounts }>;
export type PileQueueEntry = Readonly<{
  presentation: PreparedGamePresentation;
  gameId: string;
  revision: number;
  baseline: DisplayCounts;
  milestones: readonly PileMilestone[];
}>;

function validatedHandCounts(
  previous: GameView,
  incoming: GameView,
  events: readonly GameEvent[],
): Record<string, number> | null {
  const initial = new Map(previous.players.map(({ id, handSize }) => [id, handSize]));
  const counts = new Map(initial);
  const removed = new Map<string, number>();
  const drawn = new Map<string, number>();
  if (
    initial.size !== previous.players.length ||
    incoming.players.length !== previous.players.length ||
    previous.players.find((player) => player.id === previous.viewer.id)?.handSize !==
      previous.viewer.hand.length ||
    incoming.players.find((player) => player.id === incoming.viewer.id)?.handSize !==
      incoming.viewer.hand.length
  ) {
    return null;
  }
  for (const event of events) {
    if (event.type === 'enemyDefeated' || event.type === 'heartsRecovered') {
      continue;
    }
    if (event.type === 'diamondCardsDrawn') {
      for (const id of event.recipientIds) {
        const count = counts.get(id);
        if (count === undefined) {
          return null;
        }
        counts.set(id, count + 1);
        drawn.set(id, (drawn.get(id) ?? 0) + 1);
      }
    } else {
      const count = counts.get(event.playerId);
      if (count === undefined || count < event.cards.length) {
        return null;
      }
      counts.set(event.playerId, count - event.cards.length);
      removed.set(event.playerId, (removed.get(event.playerId) ?? 0) + event.cards.length);
    }
  }
  if (
    incoming.players.some(({ id, handSize }) => {
      // Subtract successful draws, not a reconstructed dealing order or hand capacity.
      const beforeDraw = handSize - (drawn.get(id) ?? 0);
      return (
        beforeDraw < 0 ||
        beforeDraw !== (initial.get(id) ?? -1) - (removed.get(id) ?? 0) ||
        counts.get(id) !== handSize
      );
    }) ||
    new Set(incoming.players.map((player) => player.id)).size !== initial.size
  ) {
    return null;
  }
  return Object.fromEntries(initial);
}

export function pileCounts(view: GameView): PileCounts {
  return { discardCount: view.discard.cards.length, tavernCount: view.tavern.remainingCards };
}

export function preparePileEntries(
  gameId: string,
  revision: number,
  previous: GameView,
  incoming: GameView,
  events: readonly GameEvent[],
  presentations: readonly PreparedGamePresentation[],
): PileQueueEntry[] | null {
  const consumed = new Set<number>();
  const entries: PileQueueEntry[] = [];
  const initialHands = validatedHandCounts(previous, incoming, events);
  if (!initialHands && events.some((event) => event.type === 'diamondCardsDrawn')) {
    return null;
  }
  let counts: DisplayCounts = { ...pileCounts(previous), handCounts: initialHands };
  const change = (discardDelta: number, tavernDelta: number, playerId?: string, handDelta = 0) => {
    const hands = counts.handCounts;
    counts = {
      discardCount: counts.discardCount + discardDelta,
      tavernCount: counts.tavernCount + tavernDelta,
      handCounts:
        hands && playerId !== undefined
          ? { ...hands, [playerId]: hands[playerId]! + handDelta }
          : hands,
    };
  };
  for (const presentation of presentations) {
    // The accepted play has left the player's hand before Diamonds can deal to them.
    if (presentation.type === 'cardsPlayed') {
      change(0, 0, presentation.playerId, -presentation.cards.length);
    } else if (presentation.type === 'enemyDefeatSequence') {
      change(0, 0, presentation.playerId, -presentation.playedCards.length);
    }
    const baseline = counts;
    const milestones: PileMilestone[] = [];
    const add = (
      key: string,
      discardDelta: number,
      tavernDelta: number,
      playerId?: string,
      handDelta = 0,
    ) => {
      change(discardDelta, tavernDelta, playerId, handDelta);
      milestones.push({ key, counts });
    };
    switch (presentation.type) {
      case 'cardsPlayed':
        consumed.add(presentation.eventId);
        break;
      case 'heartsRecovery':
        consumed.add(presentation.eventId);
        add('hearts', -presentation.recoveredCount, presentation.recoveredCount);
        break;
      case 'diamondCardsDrawn':
        consumed.add(presentation.eventId);
        presentation.recipients.forEach((id, index) => add(`deal:${index}`, 0, -1, id, 1));
        break;
      case 'cardsDiscardedForDamage':
        consumed.add(presentation.eventId);
        presentation.cards.forEach((_, index) =>
          add(`damage:${index}`, 1, 0, presentation.playerId, -1),
        );
        break;
      case 'enemyDefeatSequence':
        consumed.add(presentation.eventId);
        consumed.add(presentation.defeatEventId);
        if (presentation.heartsRecovery) {
          consumed.add(presentation.heartsRecovery.eventId);
          add(
            'hearts',
            -presentation.heartsRecovery.recoveredCount,
            presentation.heartsRecovery.recoveredCount,
          );
        }
        if (presentation.diamondCardsDrawn) {
          consumed.add(presentation.diamondCardsDrawn.eventId);
          presentation.diamondCardsDrawn.recipients.forEach((id, index) =>
            add(`deal:${index}`, 0, -1, id, 1),
          );
        }
        add(
          'enemy',
          presentation.enemy.destination === 'discard' ? 1 : 0,
          presentation.enemy.destination === 'tavern' ? 1 : 0,
        );
        presentation.battleCards.forEach((_, index) => add(`cleanup:${index}`, 1, 0));
        break;
    }
    if (counts.discardCount < 0 || counts.tavernCount < 0) {
      return null;
    }
    entries.push({ presentation, gameId, revision, baseline, milestones });
  }
  const authoritative = pileCounts(incoming);
  if (
    events.some((event) => !consumed.has(event.id)) ||
    counts.discardCount !== authoritative.discardCount ||
    counts.tavernCount !== authoritative.tavernCount ||
    (counts.handCounts !== null &&
      incoming.players.some((player) => counts.handCounts?.[player.id] !== player.handSize))
  ) {
    return null;
  }
  return entries;
}
