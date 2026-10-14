import type { AnimationSequence } from 'motion/react';
import { appendArrival } from './animation-milestone.ts';
import {
  gamePresentationAnchor,
  isVisibleRect,
  type GamePresentationAnchorKey,
  type PreparedHeartsRecovery,
  type RectSnapshot,
} from '../game-presentation.types.ts';

export type GetAnchorRect = (key: GamePresentationAnchorKey) => RectSnapshot | null;

type Geometry = {
  source: RectSnapshot | null;
  destination: RectSnapshot | null;
  position: RectSnapshot | null;
};

export function heartsGeometry(
  presentation: PreparedHeartsRecovery,
  getAnchorRect: GetAnchorRect,
  reduced: boolean,
): Geometry {
  const visible = (key: GamePresentationAnchorKey, fallback: RectSnapshot | null) => {
    const current = getAnchorRect(key);
    if (isVisibleRect(current)) {
      return current;
    }
    return isVisibleRect(fallback) ? fallback : null;
  };
  const source = visible(gamePresentationAnchor.discard, presentation.fallbackDiscard);
  const destination = visible(gamePresentationAnchor.tavern, presentation.fallbackTavern);
  return {
    source,
    destination,
    position: reduced ? (destination ?? source) : (source ?? destination),
  };
}

/** Appends a relative-time Hearts segment to the caller's Motion timeline. */
export function appendHeartsSequence(
  sequence: AnimationSequence,
  element: HTMLDivElement | null,
  geometry: Geometry,
  reduced: boolean,
  start: number,
  onArrival?: () => void,
): number {
  if (!element || !geometry.position) {
    if (onArrival) {
      appendArrival(sequence, start, onArrival);
    }
    return start;
  }
  const { source, destination } = geometry;
  if (reduced || !source || !destination) {
    sequence.push([element, { opacity: [0, 1, 1, 0] }, { at: start, duration: 0.36 }]);
    if (onArrival) {
      appendArrival(sequence, start + 0.36, onArrival);
    }
    return start + 0.36;
  }
  sequence.push([element, { opacity: [0, 1] }, { at: start, duration: 0.1 }]);
  for (const [index, card] of Array.from(
    element.querySelectorAll<HTMLElement>('[data-heart-card]'),
  ).entries()) {
    sequence.push([
      card,
      { x: [0, index % 2 ? 4 : -4, 0], rotate: [0, index % 2 ? 5 : -5, 0] },
      { at: start, duration: 0.3, ease: 'easeInOut' },
    ]);
  }
  sequence.push([
    element,
    {
      x: [0, destination.left - source.left],
      y: [0, destination.top - source.top],
      scaleX: [1, destination.width / source.width],
      scaleY: [1, destination.height / source.height],
    },
    { at: start + 0.31, duration: 0.5, ease: 'easeInOut' },
  ]);
  sequence.push([
    element,
    { scale: [1, 0.8], opacity: [1, 0] },
    { at: start + 0.81, duration: 0.2, ease: 'easeIn' },
  ]);
  if (onArrival) {
    appendArrival(sequence, start + 0.81, onArrival);
  }
  return start + 1.01;
}
