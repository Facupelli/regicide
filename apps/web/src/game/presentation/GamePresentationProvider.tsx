import type { CardsPlayedEvent, GameEvent, GameView } from '@regicide/protocol';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { CardsDiscardedForDamagePresentation } from './animations/CardsDiscardedForDamagePresentation.tsx';
import { CardsPlayedPresentation } from './animations/CardsPlayedPresentation.tsx';
import { DiamondCardsDrawnPresentation } from './animations/DiamondCardsDrawnPresentation.tsx';
import { EnemyDefeatSequencePresentation } from './animations/EnemyDefeatSequencePresentation.tsx';
import { HeartsRecoveryPresentation } from './animations/HeartsRecoveryPresentation.tsx';
import { GamePresentationContext } from './GamePresentationContext.ts';
import { preparePileEntries, type DisplayCounts, type PileQueueEntry } from './pile-display.ts';
import {
  gamePresentationAnchor,
  isVisibleRect,
  snapshotRect,
  type GamePresentationAnchorKey,
  type PreparedCardsPlayed,
  type PreparedDiamondCardsDrawn,
  type PreparedGamePresentation,
  type PreparedHeartsRecovery,
  type RectSnapshot,
} from './game-presentation.types.ts';

type QueueState = {
  active: PileQueueEntry | null;
  pending: PileQueueEntry[];
  displayed: DisplayCounts | null;
  nextMilestone: number;
};

const emptyQueue: QueueState = { active: null, pending: [], displayed: null, nextMilestone: 0 };
const MAX_PENDING_PRESENTATIONS = 3;

export function GamePresentationProvider({ children }: { children: ReactNode }) {
  const anchors = useRef(new Map<GamePresentationAnchorKey, HTMLElement>());
  // Scope only the animation queue, not game or connection state.
  const sessionKey = useRef<string | null>(null);
  const [queue, setQueue] = useState<QueueState>(emptyQueue);

  const registerAnchor = useCallback(
    (key: GamePresentationAnchorKey, element: HTMLElement | null) => {
      if (element) {
        anchors.current.set(key, element);
      } else {
        anchors.current.delete(key);
      }
    },
    [],
  );
  const getAnchorRect = useCallback(
    (key: GamePresentationAnchorKey) => snapshotRect(anchors.current.get(key)),
    [],
  );

  const prepare = useCallback(
    (
      events: readonly GameEvent[],
      localPlayerId: string,
      consecutiveViews: { previous: GameView; incoming: GameView } | null,
    ): PreparedGamePresentation[] => {
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
        const remoteCardSource = isVisibleRect(remoteSource) ? remoteSource : null;
        return {
          type: 'cardsPlayed',
          eventId: event.id,
          playerId: event.playerId,
          cards: event.cards.map((card) => ({
            card,
            source:
              event.playerId === localPlayerId
                ? visible(gamePresentationAnchor.card(card.id))
                : remoteCardSource,
          })),
          fallbackBattleTarget,
        };
      };
      for (let index = 0; index < events.length; index++) {
        const event = events[index];
        if (!event) {
          continue;
        }
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
            let nextIndex = index + 1;
            const possibleHeart = events[nextIndex];
            const heartEvent = possibleHeart?.type === 'heartsRecovered' ? possibleHeart : null;
            if (heartEvent) {
              nextIndex++;
            }
            const heartsRecovery: PreparedHeartsRecovery | null = heartEvent
              ? {
                  type: 'heartsRecovery',
                  eventId: heartEvent.id,
                  recoveredCount: heartEvent.recoveredCount,
                  fallbackDiscard: visible(gamePresentationAnchor.discard),
                  fallbackTavern: visible(gamePresentationAnchor.tavern),
                }
              : null;
            const possibleDraw = events[nextIndex];
            const drawEvent = possibleDraw?.type === 'diamondCardsDrawn' ? possibleDraw : null;
            // A draw event belongs to this play even when a revision gap prevents animating it.
            if (drawEvent) {
              nextIndex++;
            }
            const diamondCardsDrawn: PreparedDiamondCardsDrawn | null =
              consecutiveViews && drawEvent
                ? {
                    type: 'diamondCardsDrawn',
                    eventId: drawEvent.id,
                    recipients: drawEvent.recipientIds,
                    localPlayerId,
                    fallbackTavern: visible(gamePresentationAnchor.tavern),
                    fallbackDestinations: Object.fromEntries(
                      drawEvent.recipientIds.map((playerId) => [
                        playerId,
                        visible(
                          playerId === localPlayerId
                            ? gamePresentationAnchor.localHand
                            : gamePresentationAnchor.player(playerId),
                        ),
                      ]),
                    ),
                  }
                : null;
            const next = events[nextIndex];
            if (next?.type !== 'enemyDefeated' || next.playerId !== event.playerId) {
              prepared.push(play);
              if (heartsRecovery) {
                prepared.push(heartsRecovery);
              }
              if (diamondCardsDrawn) {
                prepared.push(diamondCardsDrawn);
              }
              index = nextIndex - 1;
              break;
            }
            index = nextIndex;
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
              heartsRecovery,
              diamondCardsDrawn,
            });
            break;
          }
          case 'heartsRecovered':
          case 'diamondCardsDrawn':
          case 'enemyDefeated':
            // These are consumed with their matching cardsPlayed event.
            break;
        }
      }
      return prepared;
    },
    [getAnchorRect],
  );

  const cancelPresentations = useCallback(() => setQueue(emptyQueue), []);
  useEffect(() => {
    const clearWhenHidden = () => {
      if (document.visibilityState === 'hidden') {
        cancelPresentations();
      }
    };
    document.addEventListener('visibilitychange', clearWhenHidden);
    return () => document.removeEventListener('visibilitychange', clearWhenHidden);
  }, [cancelPresentations]);

  const switchSession = useCallback((key: string | null) => {
    if (sessionKey.current === key) {
      return;
    }
    sessionKey.current = key;
    setQueue(emptyQueue);
  }, []);

  const presentUpdate = useCallback(
    (
      gameId: string,
      revision: number,
      events: readonly GameEvent[],
      localPlayerId: string,
      commitView: () => void,
      consecutiveViews: { previous: GameView; incoming: GameView } | null,
    ) => {
      const prepared = prepare(events, localPlayerId, consecutiveViews);
      const entries =
        consecutiveViews && sessionKey.current === gameId && document.visibilityState === 'visible'
          ? preparePileEntries(
              gameId,
              revision,
              consecutiveViews.previous,
              consecutiveViews.incoming,
              events,
              prepared,
            )
          : null;
      flushSync(() => {
        setQueue((current) => {
          if (!entries?.length) {
            return emptyQueue;
          }
          const pending = [...current.pending, ...entries];
          if (pending.length > MAX_PENDING_PRESENTATIONS) {
            return emptyQueue;
          }
          if (current.active) {
            return { ...current, pending };
          }
          const [active, ...rest] = pending;
          return {
            active: active ?? null,
            pending: rest,
            displayed: active?.baseline ?? null,
            nextMilestone: 0,
          };
        });
        commitView();
      });
    },
    [prepare],
  );

  const onMilestone = useCallback((entry: PileQueueEntry, key: string) => {
    if (sessionKey.current !== entry.gameId) {
      return;
    }
    setQueue((current) => {
      if (current.active !== entry) {
        return current;
      }
      const milestone = entry.milestones[current.nextMilestone];
      if (milestone?.key !== key) {
        return entry.milestones.slice(current.nextMilestone + 1).some((later) => later.key === key)
          ? emptyQueue
          : current;
      }
      return { ...current, displayed: milestone.counts, nextMilestone: current.nextMilestone + 1 };
    });
  }, []);

  const onComplete = useCallback((completed: PileQueueEntry) => {
    if (sessionKey.current !== completed.gameId) {
      return;
    }
    setQueue((current) => {
      if (current.active !== completed) {
        return current;
      }
      const [active, ...pending] = current.pending;
      return active
        ? { active, pending, displayed: active.baseline, nextMilestone: 0 }
        : emptyQueue;
    });
  }, []);

  const onCancelled = useCallback((entry: PileQueueEntry) => {
    if (sessionKey.current !== entry.gameId) {
      return;
    }
    setQueue((current) => (current.active === entry ? emptyQueue : current));
  }, []);

  const value = useMemo(
    () => ({
      registerAnchor,
      displayedPiles: queue.displayed,
      displayedHandCounts: queue.displayed?.handCounts ?? null,
      presentUpdate,
      switchSession,
      cancelPresentations,
    }),
    [registerAnchor, queue.displayed, presentUpdate, switchSession, cancelPresentations],
  );

  return (
    <GamePresentationContext value={value}>
      {children}
      {queue.active &&
        createPortal(
          <GamePresentationOverlay
            key={`${queue.active.gameId}:${queue.active.revision}:${queue.active.presentation.eventId}:${queue.active.presentation.type}`}
            entry={queue.active}
            getAnchorRect={getAnchorRect}
            onMilestone={onMilestone}
            onComplete={onComplete}
            onCancelled={onCancelled}
          />,
          document.body,
        )}
    </GamePresentationContext>
  );
}

type GetAnchorRect = (key: GamePresentationAnchorKey) => RectSnapshot | null;

const GamePresentationOverlay = memo(function GamePresentationOverlay({
  entry,
  getAnchorRect,
  onMilestone,
  onComplete,
  onCancelled,
}: {
  entry: PileQueueEntry;
  getAnchorRect: GetAnchorRect;
  onMilestone: (entry: PileQueueEntry, key: string) => void;
  onComplete: (entry: PileQueueEntry) => void;
  onCancelled: (entry: PileQueueEntry) => void;
}) {
  const presentation = entry.presentation;
  const [mounted, setMounted] = useState(false);
  const measure = useCallback((element: HTMLDivElement | null) => {
    if (element) {
      setMounted(true);
    }
  }, []);
  const complete = () => onComplete(entry);
  const cancel = () => onCancelled(entry);
  const arrived = (key: string) => onMilestone(entry, key);

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
                  onArrival={arrived}
                  onComplete={complete}
                  onCancelled={cancel}
                />
              );
            case 'diamondCardsDrawn':
              return (
                <DiamondCardsDrawnPresentation
                  presentation={presentation}
                  getAnchorRect={getAnchorRect}
                  onArrival={arrived}
                  onComplete={complete}
                  onCancelled={cancel}
                />
              );
            case 'heartsRecovery':
              return (
                <HeartsRecoveryPresentation
                  presentation={presentation}
                  getAnchorRect={getAnchorRect}
                  onArrival={arrived}
                  onComplete={complete}
                  onCancelled={cancel}
                />
              );
            case 'cardsPlayed':
              return (
                <CardsPlayedPresentation
                  presentation={presentation}
                  getAnchorRect={getAnchorRect}
                  onComplete={complete}
                  onCancelled={cancel}
                />
              );
            case 'enemyDefeatSequence':
              return (
                <EnemyDefeatSequencePresentation
                  presentation={presentation}
                  getAnchorRect={getAnchorRect}
                  onArrival={arrived}
                  onComplete={complete}
                  onCancelled={cancel}
                />
              );
          }
        })()}
    </div>
  );
});
