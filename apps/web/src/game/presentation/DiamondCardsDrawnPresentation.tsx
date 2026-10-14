import { useEffect, useRef, type CSSProperties } from 'react';
import { useAnimate, useReducedMotion, type AnimationSequence } from 'motion/react';
import { PlayingCard } from '../cards/PlayingCard.tsx';
import { appendDiamondSequence, diamondFlights, type Flight } from './diamonds-draw-sequence.ts';
import type {
  GamePresentationAnchorKey,
  PreparedDiamondCardsDrawn,
  RectSnapshot,
} from './game-presentation.types.ts';

export function DiamondCardsDrawnPresentation({
  presentation,
  getAnchorRect,
  onComplete,
}: {
  presentation: PreparedDiamondCardsDrawn;
  getAnchorRect: (key: GamePresentationAnchorKey) => RectSnapshot | null;
  onComplete: () => void;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduced = useReducedMotion() ?? false;
  const elements = useRef(new Map<number, HTMLElement>());
  const flights = diamondFlights(presentation, getAnchorRect, reduced);

  useEffect(() => {
    const sequence: AnimationSequence = [];
    appendDiamondSequence(sequence, elements.current, flights, reduced, 0);
    if (!sequence.length) {
      onComplete();
      return;
    }
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
    // Geometry is frozen for this mounted presentation, as in the defeat sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, presentation, reduced, scope]);

  return (
    <div ref={scope}>
      <DiamondCardsDrawnVisual
        flights={flights}
        setCard={(index, element) => {
          if (element) {
            elements.current.set(index, element);
          } else {
            elements.current.delete(index);
          }
        }}
      />
    </div>
  );
}

export function DiamondCardsDrawnVisual({
  flights,
  setCard,
}: {
  flights: readonly Flight[];
  setCard: (index: number, element: HTMLDivElement | null) => void;
}) {
  return (
    <div aria-hidden="true">
      {flights.map(({ position }, index) =>
        position ? (
          <div
            key={index}
            ref={(element) => setCard(index, element)}
            className="absolute origin-center opacity-0"
            style={
              {
                left: position.left,
                top: position.top,
                width: position.width,
                height: position.height,
                zIndex: 30 + index,
                '--pile-card-width': `${position.width}px`,
              } as CSSProperties
            }
          >
            <PlayingCard variant="pile" />
          </div>
        ) : null,
      )}
    </div>
  );
}
