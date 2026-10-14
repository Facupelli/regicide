import type { AnimationSequence } from 'motion/react';
import {
  gamePresentationAnchor,
  isVisibleRect,
  type GamePresentationAnchorKey,
  type PreparedDiamondCardsDrawn,
  type RectSnapshot,
} from './game-presentation.types.ts';

type GetAnchorRect = (key: GamePresentationAnchorKey) => RectSnapshot | null;

export type Flight = {
  position: RectSnapshot | null;
  destination: RectSnapshot | null;
  source: RectSnapshot | null;
};

export function diamondFlights(
  presentation: PreparedDiamondCardsDrawn,
  getAnchorRect: GetAnchorRect,
  reduced: boolean,
): Flight[] {
  const currentTavern = getAnchorRect(gamePresentationAnchor.tavern);
  // The Tavern can be empty after the committed draw; prefer its pre-commit position.
  let source: RectSnapshot | null = null;
  if (isVisibleRect(presentation.fallbackTavern)) {
    source = presentation.fallbackTavern;
  } else if (isVisibleRect(currentTavern)) {
    source = currentTavern;
  }
  return presentation.recipients.map((playerId) => {
    const key =
      playerId === presentation.localPlayerId
        ? gamePresentationAnchor.localHand
        : gamePresentationAnchor.player(playerId);
    const current = getAnchorRect(key);
    const target = isVisibleRect(current)
      ? current
      : (presentation.fallbackDestinations[playerId] ?? null);
    const visibleTarget = isVisibleRect(target) ? target : null;
    const width = source?.width ?? presentation.fallbackTavern?.width ?? 40;
    const height = source?.height ?? presentation.fallbackTavern?.height ?? width * 1.4;
    const destination = visibleTarget
      ? {
          left: visibleTarget.left + (visibleTarget.width - width) / 2,
          top: visibleTarget.top + (visibleTarget.height - height) / 2,
          width,
          height,
        }
      : null;
    return {
      source,
      destination,
      position: reduced ? (destination ?? source) : (source ?? destination),
    };
  });
}

const TRAVEL_SECONDS = 0.3;
const LARGE_DRAW_TRAVEL_SECONDS = 0.22;
const LARGE_DRAW_THRESHOLD = 7;
const ARRIVAL_SECONDS = 0.08;
const BETWEEN_CARDS_SECONDS = 0.035;
const REDUCED_CARD_SECONDS = 0.09;
const FALLBACK_CARD_SECONDS = 0.12;

/** Appends sequential, relative-time face-down deals to a Motion timeline. */
export function appendDiamondSequence(
  sequence: AnimationSequence,
  elements: ReadonlyMap<number, HTMLElement>,
  flights: readonly Flight[],
  reduced: boolean,
  start: number,
): number {
  const travelSeconds =
    flights.length >= LARGE_DRAW_THRESHOLD ? LARGE_DRAW_TRAVEL_SECONDS : TRAVEL_SECONDS;
  const lastVisibleIndex = flights.findLastIndex(
    ({ position }, index) => position && elements.has(index),
  );
  let cursor = start;
  flights.forEach(({ source, destination, position }, index) => {
    const element = elements.get(index);
    if (!element || !position) {
      return;
    }
    if (reduced || !source || !destination) {
      const duration = reduced ? REDUCED_CARD_SECONDS : FALLBACK_CARD_SECONDS;
      sequence.push([
        element,
        { opacity: [0, 0.85, 0], scale: [0.95, 1.06, 1] },
        { at: cursor, duration },
      ]);
      cursor += duration;
    } else {
      const arrival = cursor + travelSeconds;
      sequence.push([
        element,
        {
          x: [0, destination.left - source.left],
          y: [0, destination.top - source.top],
          opacity: [0, 1, 1],
        },
        {
          at: cursor,
          duration: travelSeconds,
          ease: 'easeInOut',
          opacity: { times: [0, 0.05, 1], ease: 'linear' },
        },
      ]);
      sequence.push([
        element,
        { scale: [1, 1.12, 1], opacity: [1, 1, 0] },
        { at: arrival, duration: ARRIVAL_SECONDS },
      ]);
      cursor = arrival + ARRIVAL_SECONDS;
    }
    if (!reduced && index < lastVisibleIndex) {
      cursor += BETWEEN_CARDS_SECONDS;
    }
  });
  return cursor;
}
