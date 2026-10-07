import type { CardsPlayedEvent, GameEvent } from '@regicide/protocol';
import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { CardsDiscardedForDamagePresentation } from './CardsDiscardedForDamagePresentation.tsx';
import { CardsPlayedPresentation } from './CardsPlayedPresentation.tsx';
import { EnemyDefeatSequencePresentation } from './EnemyDefeatSequencePresentation.tsx';
import { GamePresentationContext } from './GamePresentationContext.ts';
import {
  gamePresentationAnchor,
  isVisibleRect,
  snapshotRect,
  type GamePresentationAnchorKey,
  type PreparedCardsPlayed,
  type PreparedGamePresentation,
  type RectSnapshot,
} from './game-presentation.types.ts';

type QueueState = {
  active: PreparedGamePresentation | null;
  pending: PreparedGamePresentation[];
};

type GetAnchorRect = (key: GamePresentationAnchorKey) => RectSnapshot | null;

const GamePresentationOverlay = memo(function GamePresentationOverlay({
  presentation,
  getAnchorRect,
  onComplete,
}: {
  presentation: PreparedGamePresentation;
  getAnchorRect: GetAnchorRect;
  onComplete: (presentation: PreparedGamePresentation) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const measure = useCallback((element: HTMLDivElement | null) => {
    if (element) setMounted(true);
  }, []);
  const complete = () => onComplete(presentation);

  return (
    <div ref={measure} className="pointer-events-none fixed inset-0 z-100 overflow-visible">
      {mounted &&
        (() => {
          switch (presentation.type) {
            case 'cardsDiscardedForDamage':
              return (
                <CardsDiscardedForDamagePresentation
                  presentation={presentation}
                  destination={
                    getAnchorRect(gamePresentationAnchor.discard) ??
                    presentation.fallbackDestination
                  }
                  onComplete={complete}
                />
              );
            case 'cardsPlayed':
              return (
                <CardsPlayedPresentation
                  presentation={presentation}
                  getAnchorRect={getAnchorRect}
                  onComplete={complete}
                />
              );
            case 'enemyDefeatSequence':
              return (
                <EnemyDefeatSequencePresentation
                  presentation={presentation}
                  getAnchorRect={getAnchorRect}
                  onComplete={complete}
                />
              );
          }
        })()}
    </div>
  );
});

export function GamePresentationProvider({ children }: { children: ReactNode }) {
  const anchors = useRef(new Map<GamePresentationAnchorKey, HTMLElement>());
  // Scope only the animation queue, not game or connection state.
  const sessionKey = useRef<string | null>(null);
  const [queue, setQueue] = useState<QueueState>({ active: null, pending: [] });

  const registerAnchor = useCallback(
    (key: GamePresentationAnchorKey, element: HTMLElement | null) => {
      if (element) anchors.current.set(key, element);
      else anchors.current.delete(key);
    },
    [],
  );
  const getAnchorRect = useCallback(
    (key: GamePresentationAnchorKey) => snapshotRect(anchors.current.get(key)),
    [],
  );

  const prepare = useCallback(
    (events: readonly GameEvent[], localPlayerId: string): PreparedGamePresentation[] => {
      const prepared: PreparedGamePresentation[] = [];
      const visible = (key: GamePresentationAnchorKey) => {
        const rect = getAnchorRect(key);
        return isVisibleRect(rect) ? rect : null;
      };
      const played = (event: CardsPlayedEvent): PreparedCardsPlayed => {
        const fallbackBattleTarget = visible(gamePresentationAnchor.battleTarget);
        const seat = visible(gamePresentationAnchor.player(event.playerId));
        const remoteSource =
          seat && fallbackBattleTarget
            ? {
                left: seat.left + (seat.width - fallbackBattleTarget.width) / 2,
                top: seat.top + (seat.height - fallbackBattleTarget.height) / 2,
                width: fallbackBattleTarget.width,
                height: fallbackBattleTarget.height,
              }
            : null;
        return {
          type: 'cardsPlayed',
          eventId: event.id,
          playerId: event.playerId,
          cards: event.cards.map((card) => ({
            card,
            source:
              event.playerId === localPlayerId
                ? visible(gamePresentationAnchor.card(card.id))
                : isVisibleRect(remoteSource)
                  ? remoteSource
                  : null,
          })),
          fallbackBattleTarget,
        };
      };
      for (let index = 0; index < events.length; index++) {
        const event = events[index];
        if (!event) continue;
        switch (event.type) {
          case 'cardsDiscardedForDamage': {
            const fallbackDestination = visible(gamePresentationAnchor.discard);
            const seat = visible(gamePresentationAnchor.player(event.playerId));
            const remoteSource =
              seat && fallbackDestination
                ? {
                    left: seat.left + (seat.width - fallbackDestination.width) / 2,
                    top: seat.top + (seat.height - fallbackDestination.height) / 2,
                    width: fallbackDestination.width,
                    height: fallbackDestination.height,
                  }
                : null;
            prepared.push({
              type: event.type,
              eventId: event.id,
              playerId: event.playerId,
              cards: event.cards.map((card) => ({
                card,
                source:
                  event.playerId === localPlayerId
                    ? visible(gamePresentationAnchor.card(card.id))
                    : remoteSource,
              })),
              fallbackDestination,
            });
            break;
          }
          case 'cardsPlayed': {
            const play = played(event);
            const next = events[index + 1];
            if (next?.type !== 'enemyDefeated' || next.playerId !== event.playerId) {
              prepared.push(play);
              break;
            }
            index++;
            const playedIds = new Set(event.cards.map((card) => card.id));
            prepared.push({
              type: 'enemyDefeatSequence',
              eventId: event.id,
              defeatEventId: next.id,
              playerId: event.playerId,
              playedCards: play.cards,
              battleCards: next.discardedCards.map((card) => ({
                card,
                newlyPlayed: playedIds.has(card.id),
                source: playedIds.has(card.id)
                  ? null
                  : visible(gamePresentationAnchor.battleCard(card.id)),
              })),
              enemy: {
                card: next.enemy,
                source: visible(gamePresentationAnchor.enemy),
                destination: next.destination,
              },
              fallbackBattleTarget: play.fallbackBattleTarget,
              fallbackDiscard: visible(gamePresentationAnchor.discard),
              fallbackTavern: visible(gamePresentationAnchor.tavern),
            });
            break;
          }
          case 'enemyDefeated':
            // The server emits this immediately after its matching cardsPlayed event.
            break;
        }
      }
      return prepared;
    },
    [getAnchorRect],
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

  const switchSession = useCallback((key: string | null) => {
    if (sessionKey.current === key) return;
    sessionKey.current = key;
    setQueue({ active: null, pending: [] });
  }, []);

  const presentUpdate = useCallback(
    (events: readonly GameEvent[], localPlayerId: string, commitView: () => void) => {
      const prepared = prepare(events, localPlayerId);
      flushSync(commitView);
      enqueue(prepared);
    },
    [prepare, enqueue],
  );

  const onComplete = useCallback((completed: PreparedGamePresentation) => {
    setQueue((current) => {
      if (current.active !== completed) return current;
      const [active, ...pending] = current.pending;
      return { active: active ?? null, pending };
    });
  }, []);

  const value = useMemo(
    () => ({ registerAnchor, presentUpdate, switchSession }),
    [registerAnchor, presentUpdate, switchSession],
  );

  return (
    <GamePresentationContext value={value}>
      {children}
      {queue.active &&
        createPortal(
          <GamePresentationOverlay
            key={queue.active.eventId}
            presentation={queue.active}
            getAnchorRect={getAnchorRect}
            onComplete={onComplete}
          />,
          document.body,
        )}
    </GamePresentationContext>
  );
}
