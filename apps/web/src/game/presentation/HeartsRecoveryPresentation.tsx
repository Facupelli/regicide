import { useEffect, useRef, type CSSProperties } from 'react';
import { useAnimate, useReducedMotion, type AnimationSequence } from 'motion/react';
import { PlayingCard } from '../cards/PlayingCard.tsx';
import type { PreparedHeartsRecovery, RectSnapshot } from './game-presentation.types.ts';
import {
  appendHeartsSequence,
  heartsGeometry,
  type GetAnchorRect,
} from './hearts-recovery-sequence.ts';

export function HeartsRecoveryVisual({
  presentation,
  position,
  elementRef,
}: {
  presentation: PreparedHeartsRecovery;
  position: RectSnapshot | null;
  elementRef: (element: HTMLDivElement | null) => void;
}) {
  if (!position) {
    return null;
  }
  return (
    <div
      ref={elementRef}
      className="absolute origin-top-left opacity-0"
      style={
        {
          left: position.left,
          top: position.top,
          width: position.width,
          height: position.height,
          '--pile-card-width': `${position.width}px`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          data-heart-card=""
          className="absolute origin-center"
          style={{ left: index * 3, top: -index * 3, zIndex: index }}
        >
          <PlayingCard variant="pile" />
        </div>
      ))}
      <span className="absolute -top-9 left-1/2 z-3 -translate-x-1/2 rounded-full border border-card-border bg-panel px-2 py-0.5 text-sm font-bold whitespace-nowrap text-foreground shadow-md">
        +{presentation.recoveredCount}
      </span>
    </div>
  );
}

export function HeartsRecoveryPresentation({
  presentation,
  getAnchorRect,
  onComplete,
}: {
  presentation: PreparedHeartsRecovery;
  getAnchorRect: GetAnchorRect;
  onComplete: () => void;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduced = useReducedMotion() ?? false;
  const element = useRef<HTMLDivElement | null>(null);
  const geometry = heartsGeometry(presentation, getAnchorRect, reduced);

  useEffect(() => {
    const sequence: AnimationSequence = [];
    appendHeartsSequence(sequence, element.current, geometry, reduced, 0);
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
    // Geometry is frozen for this presentation, as in the existing defeat sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, presentation, reduced, scope]);

  return (
    <div ref={scope}>
      <HeartsRecoveryVisual
        presentation={presentation}
        position={geometry.position}
        elementRef={(node) => {
          element.current = node;
        }}
      />
    </div>
  );
}
