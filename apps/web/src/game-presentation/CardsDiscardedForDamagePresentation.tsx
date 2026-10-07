import { useEffect, useMemo, type CSSProperties } from 'react';
import { useAnimate, useReducedMotion, type AnimationSequence } from 'motion/react';
import { PlayingCard } from '../components/ui/PlayingCard.tsx';
import {
  isVisibleRect,
  type PreparedCardsDiscardedForDamage,
  type RectSnapshot,
} from './game-presentation.types.ts';

const CARD_STAGGER_SECONDS = 0.12;
const CARD_MOVE_SECONDS = 0.4;
const CARD_HOLD_SECONDS = 0.25;
const CARD_FADE_SECONDS = 0.12;

type Props = {
  presentation: PreparedCardsDiscardedForDamage;
  destination: RectSnapshot | null;
  onComplete: () => void;
};

export function CardsDiscardedForDamagePresentation({
  presentation,
  destination,
  onComplete,
}: Props) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const shouldReduceMotion = useReducedMotion();
  const landing = isVisibleRect(destination) ? destination : null;
  const flights = useMemo(
    () =>
      presentation.cards.map(({ card, source }, index) => {
        const position = shouldReduceMotion ? (landing ?? source) : (source ?? landing);
        return {
          card,
          source,
          position,
          index,
          moves: !shouldReduceMotion && !!source && !!landing,
        };
      }),
    [presentation.cards, landing, shouldReduceMotion],
  );

  useEffect(() => {
    const sequence: AnimationSequence = [];
    let lastArrival = 0;
    for (const { source, position, index, moves } of flights) {
      if (!position) continue;
      const element = scope.current.children[index] as HTMLElement | undefined;
      if (!element) continue;
      const start = index * CARD_STAGGER_SECONDS;
      sequence.push([element, { opacity: [0, 1] }, { at: start, duration: CARD_FADE_SECONDS }]);
      if (moves && source && landing) {
        sequence.push([
          element,
          {
            x: [0, landing.left - source.left],
            y: [0, landing.top - source.top],
            scale: [1, landing.width / source.width],
          },
          { at: start, duration: CARD_MOVE_SECONDS, ease: 'easeInOut' },
        ]);
      }
      lastArrival = Math.max(lastArrival, start + (moves ? CARD_MOVE_SECONDS : CARD_FADE_SECONDS));
    }
    if (!sequence.length) {
      onComplete();
      return;
    }
    for (const { index, position } of flights) {
      if (!position) continue;
      const element = scope.current.children[index] as HTMLElement;
      sequence.push([
        element,
        { opacity: [1, 0] },
        { at: lastArrival + CARD_HOLD_SECONDS, duration: CARD_FADE_SECONDS },
      ]);
    }
    let mounted = true;
    const controls = animate(sequence);
    void controls.then(
      () => {
        if (mounted) onComplete();
      },
      () => {
        // A reset may stop the animation before it finishes.
      },
    );
    return () => {
      mounted = false;
      controls.stop();
    };
  }, [animate, flights, landing, onComplete, scope]);

  return (
    <div ref={scope} aria-hidden="true">
      {flights.map(({ card, position, index }) => (
        <div
          key={`${presentation.eventId}:${index}`}
          className="absolute origin-top-left opacity-0 [&>span]:w-(--hand-card-width)!"
          style={
            position
              ? ({
                  left: position.left,
                  top: position.top,
                  width: position.width,
                  height: position.height,
                  zIndex: index + 1,
                  '--hand-card-width': `${position.width}px`,
                } as CSSProperties)
              : { display: 'none' }
          }
        >
          {position && <PlayingCard card={card} variant="hand" />}
        </div>
      ))}
    </div>
  );
}
