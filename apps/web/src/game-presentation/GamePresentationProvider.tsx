import type { GameEvent } from '@regicide/protocol';
import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CardsDiscardedForDamagePresentation } from './CardsDiscardedForDamagePresentation.tsx';
import { GamePresentationContext } from './GamePresentationContext.ts';
import {
  gamePresentationAnchor,
  isVisibleRect,
  snapshotRect,
  type GamePresentationAnchorKey,
  type PreparedGamePresentation,
  type RectSnapshot,
} from './game-presentation.types.ts';

type QueueState = {
  active: PreparedGamePresentation | null;
  pending: PreparedGamePresentation[];
};

const GamePresentationOverlay = memo(function GamePresentationOverlay({
  presentation,
  anchors,
  onComplete,
}: {
  presentation: PreparedGamePresentation;
  anchors: React.RefObject<Map<GamePresentationAnchorKey, HTMLElement>>;
  onComplete: (presentation: PreparedGamePresentation) => void;
}) {
  const [measurement, setMeasurement] = useState<{ destination: RectSnapshot | null } | null>(null);
  const measureDestination = useCallback(
    (element: HTMLDivElement | null) => {
      if (element) {
        setMeasurement({
          destination:
            snapshotRect(anchors.current.get(gamePresentationAnchor.discard)) ??
            presentation.fallbackDestination,
        });
      }
    },
    [anchors, presentation],
  );

  return (
    <div
      ref={measureDestination}
      className="fixed inset-0 z-100 overflow-visible pointer-events-none"
    >
      {measurement && (
        <CardsDiscardedForDamagePresentation
          presentation={presentation}
          destination={measurement.destination}
          onComplete={() => onComplete(presentation)}
        />
      )}
    </div>
  );
});

export function GamePresentationProvider({ children }: { children: ReactNode }) {
  const anchors = useRef(new Map<GamePresentationAnchorKey, HTMLElement>());
  const [queue, setQueue] = useState<QueueState>({ active: null, pending: [] });

  const registerAnchor = useCallback(
    (key: GamePresentationAnchorKey, element: HTMLElement | null) => {
      if (element) anchors.current.set(key, element);
      else anchors.current.delete(key);
    },
    [],
  );

  const prepare = useCallback(
    (events: readonly GameEvent[], localPlayerId: string): PreparedGamePresentation[] =>
      events.map((event) => {
        const fallbackDestination = snapshotRect(
          anchors.current.get(gamePresentationAnchor.discard),
        );
        let remoteSource: RectSnapshot | null = null;
        if (event.playerId !== localPlayerId) {
          const seat = snapshotRect(
            anchors.current.get(gamePresentationAnchor.player(event.playerId)),
          );
          if (isVisibleRect(seat) && fallbackDestination) {
            const { width, height } = fallbackDestination;
            remoteSource = {
              left: seat.left + seat.width / 2 - width / 2,
              top: seat.top + seat.height / 2 - height / 2,
              width,
              height,
            };
          }
        }
        return {
          type: event.type,
          eventId: event.id,
          playerId: event.playerId,
          cards: event.cards.map((card) => {
            const source =
              event.playerId === localPlayerId
                ? snapshotRect(anchors.current.get(gamePresentationAnchor.card(card.id)))
                : remoteSource;
            return { card, source: isVisibleRect(source) ? source : null };
          }),
          fallbackDestination,
        };
      }),
    [],
  );

  const enqueue = useCallback((presentations: readonly PreparedGamePresentation[]) => {
    if (!presentations.length) return;
    setQueue((current) => {
      if (current.active) {
        return { active: current.active, pending: [...current.pending, ...presentations] };
      }
      const [active, ...pending] = [...current.pending, ...presentations];
      return { active: active ?? null, pending };
    });
  }, []);

  const reset = useCallback(() => {
    setQueue({ active: null, pending: [] });
  }, []);

  const onComplete = useCallback((completed: PreparedGamePresentation) => {
    setQueue((current) => {
      if (current.active !== completed) return current;
      const [active, ...pending] = current.pending;
      return { active: active ?? null, pending };
    });
  }, []);

  const value = useMemo(
    () => ({ registerAnchor, prepare, enqueue, reset }),
    [registerAnchor, prepare, enqueue, reset],
  );

  return (
    <GamePresentationContext value={value}>
      {children}
      {queue.active &&
        createPortal(
          <GamePresentationOverlay
            key={queue.active.eventId}
            presentation={queue.active}
            anchors={anchors}
            onComplete={onComplete}
          />,
          document.body,
        )}
    </GamePresentationContext>
  );
}
