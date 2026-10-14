import type { GameEvent, GameView } from '@regicide/protocol';
import type { PreparedGamePresentation } from './game-presentation.types.ts';

export type PileCounts = Readonly<{ discardCount: number; tavernCount: number }>;
export type PileMilestone = Readonly<{ key: string; counts: PileCounts }>;
export type PileQueueEntry = Readonly<{
  presentation: PreparedGamePresentation;
  gameId: string;
  revision: number;
  baseline: PileCounts;
  final: PileCounts;
  milestones: readonly PileMilestone[];
}>;

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
  let counts = pileCounts(previous);
  const next = (discardDelta: number, tavernDelta: number): PileCounts => ({
    discardCount: counts.discardCount + discardDelta,
    tavernCount: counts.tavernCount + tavernDelta,
  });
  for (const presentation of presentations) {
    const baseline = counts;
    const milestones: PileMilestone[] = [];
    const add = (key: string, discardDelta: number, tavernDelta: number) => {
      counts = next(discardDelta, tavernDelta);
      milestones.push({ key, counts });
    };
    switch (presentation.type) {
      case 'cardsPlayed':
        consumed.add(presentation.eventId);
        break;
      case 'heartsRecovery':
        add('hearts', -presentation.recoveredCount, presentation.recoveredCount);
        break;
      case 'diamondCardsDrawn':
        consumed.add(presentation.eventId);
        presentation.recipients.forEach((_, index) => add(`deal:${index}`, 0, -1));
        break;
      case 'cardsDiscardedForDamage':
        consumed.add(presentation.eventId);
        presentation.cards.forEach((_, index) => add(`damage:${index}`, 1, 0));
        break;
      case 'enemyDefeatSequence':
        consumed.add(presentation.eventId);
        consumed.add(presentation.defeatEventId);
        if (presentation.heartsRecovery) {
          add(
            'hearts',
            -presentation.heartsRecovery.recoveredCount,
            presentation.heartsRecovery.recoveredCount,
          );
        }
        if (presentation.diamondCardsDrawn) {
          consumed.add(presentation.diamondCardsDrawn.eventId);
          presentation.diamondCardsDrawn.recipients.forEach((_, index) =>
            add(`deal:${index}`, 0, -1),
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
    entries.push({ presentation, gameId, revision, baseline, final: counts, milestones });
  }
  const authoritative = pileCounts(incoming);
  if (
    events.some((event) => !consumed.has(event.id)) ||
    counts.discardCount !== authoritative.discardCount ||
    counts.tavernCount !== authoritative.tavernCount
  ) {
    return null;
  }
  return entries;
}
