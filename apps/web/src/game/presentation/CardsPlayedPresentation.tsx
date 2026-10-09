import { useEffect, useMemo } from 'react';
import { useAnimate, useReducedMotion, type AnimationSequence } from 'motion/react';
import { PlayingCard } from '../cards/PlayingCard.tsx';
import {
  gamePresentationAnchor,
  isVisibleRect,
  type GamePresentationAnchorKey,
  type PreparedCardsPlayed,
  type RectSnapshot,
} from './game-presentation.types.ts';

const PLAY_STAGGER_SECONDS = 0.12;
const PLAY_MOVE_SECONDS = 0.4;
const PLAY_HOLD_SECONDS = 0.18;
const PLAY_FADE_SECONDS = 0.1;

export function CardsPlayedPresentation({
  presentation,
  getAnchorRect,
  onComplete,
}: {
  presentation: PreparedCardsPlayed;
  getAnchorRect: (key: GamePresentationAnchorKey) => RectSnapshot | null;
  onComplete: () => void;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduced = useReducedMotion();
  const flights = useMemo(
    () =>
      presentation.cards.map(({ card, source }) => {
        const target = getAnchorRect(gamePresentationAnchor.battleCard(card.id));
        const fallback = getAnchorRect(gamePresentationAnchor.battleTarget);
        let destination = presentation.fallbackBattleTarget;
        if (isVisibleRect(target)) {
          destination = target;
        } else if (isVisibleRect(fallback)) {
          destination = fallback;
        }
        const landing = isVisibleRect(destination) ? destination : null;
        return { card, source, landing, position: landing ?? source };
      }),
    [getAnchorRect, presentation],
  );

  useEffect(() => {
    const sequence: AnimationSequence = [];
    let lastArrival = 0;
    flights.forEach(({ source, landing, position }, index) => {
      if (!position) {
        return;
      }
      const element = scope.current.children[index] as HTMLElement | undefined;
      if (!element) {
        return;
      }
      const start = index * PLAY_STAGGER_SECONDS;
      if (!reduced && source && landing) {
        sequence.push([
          element,
          {
            x: [source.left - landing.left, 0],
            y: [source.top - landing.top, 0],
            scaleX: [source.width / landing.width, 1],
            scaleY: [source.height / landing.height, 1],
            opacity: [1, 1],
          },
          { at: start, duration: PLAY_MOVE_SECONDS, ease: 'easeInOut' },
        ]);
        lastArrival = Math.max(lastArrival, start + PLAY_MOVE_SECONDS);
      } else {
        sequence.push([element, { opacity: [0, 1] }, { at: start, duration: PLAY_FADE_SECONDS }]);
        lastArrival = Math.max(lastArrival, start + PLAY_FADE_SECONDS);
      }
    });
    if (!sequence.length) {
      onComplete();
      return;
    }
    flights.forEach(({ position }, index) => {
      if (position) {
        sequence.push([
          scope.current.children[index] as HTMLElement,
          { opacity: [1, 0] },
          { at: lastArrival + PLAY_HOLD_SECONDS, duration: PLAY_FADE_SECONDS },
        ]);
      }
    });
    let mounted = true;
    const controls = animate(sequence);
    void controls.then(
      () => {
        if (mounted) {
          onComplete();
        }
      },
      () => {},
    );
    return () => {
      mounted = false;
      controls.stop();
    };
  }, [animate, flights, onComplete, reduced, scope]);

  return (
    <div ref={scope} aria-hidden="true">
      {flights.map(({ card, position }, index) => (
        <div
          key={card.id}
          className="absolute origin-top-left opacity-0"
          style={
            position
              ? { left: position.left, top: position.top, zIndex: index + 1 }
              : { display: 'none' }
          }
        >
          {position && <PlayingCard card={card} variant="played" />}
        </div>
      ))}
    </div>
  );
}
