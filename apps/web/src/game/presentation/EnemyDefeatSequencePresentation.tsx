import { useEffect, useMemo, useRef } from 'react';
import { useAnimate, useReducedMotion, type AnimationSequence } from 'motion/react';
import { PlayingCard } from '../cards/PlayingCard.tsx';
import {
  gamePresentationAnchor,
  isVisibleRect,
  type GamePresentationAnchorKey,
  type PreparedEnemyDefeatSequence,
  type RectSnapshot,
} from './game-presentation.types.ts';

const PLAY_STAGGER_SECONDS = 0.12;
const PLAY_MOVE_SECONDS = 0.4;
const PLAY_FADE_SECONDS = 0.1;
const DEFEAT_RECOGNITION_HOLD_SECONDS = 0.3;
const ENEMY_MOVE_SECONDS = 0.4;
const CLEANUP_STAGGER_SECONDS = 0.08;
const CLEANUP_MOVE_SECONDS = 0.35;
const CLEANUP_HOLD_SECONDS = 0.15;
const CLEANUP_FADE_SECONDS = 0.1;

type CardPosition = {
  card: PreparedEnemyDefeatSequence['battleCards'][number];
  position: RectSnapshot | null;
};

export function EnemyDefeatSequencePresentation({
  presentation,
  getAnchorRect,
  onComplete,
}: {
  presentation: PreparedEnemyDefeatSequence;
  getAnchorRect: (key: GamePresentationAnchorKey) => RectSnapshot | null;
  onComplete: () => void;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduced = useReducedMotion();
  const cardElements = useRef(new Map<string, HTMLElement>());
  const ghostElements = useRef(new Map<string, HTMLElement>());
  const enemyElement = useRef<HTMLDivElement | null>(null);
  const enemyGhost = useRef<HTMLDivElement | null>(null);
  const visible = (key: GamePresentationAnchorKey, fallback: RectSnapshot | null) => {
    const current = getAnchorRect(key);
    return isVisibleRect(current) ? current : isVisibleRect(fallback) ? fallback : null;
  };
  const battleTarget = visible(
    gamePresentationAnchor.battleTarget,
    presentation.fallbackBattleTarget,
  );
  const discard = visible(gamePresentationAnchor.discard, presentation.fallbackDiscard);
  const pile =
    presentation.enemy.destination === 'tavern'
      ? visible(gamePresentationAnchor.tavern, presentation.fallbackTavern)
      : discard;
  const oldEnemy = presentation.enemy.source;
  const enemyPosition = oldEnemy;
  const playSources = useMemo(
    () => new Map(presentation.playedCards.map(({ card, source }) => [card.id, source])),
    [presentation.playedCards],
  );
  const oldCards: CardPosition[] = presentation.battleCards
    .filter((card) => !card.newlyPlayed)
    .map((card) => ({ card, position: card.source ?? discard }));
  const looseCards: CardPosition[] = !battleTarget
    ? presentation.battleCards
        .filter((card) => card.newlyPlayed)
        .map((card) => ({
          card,
          position: playSources.get(card.card.id) ?? discard,
        }))
    : [];
  const setCard = (id: string, element: HTMLElement | null) => {
    if (element) cardElements.current.set(id, element);
    else cardElements.current.delete(id);
  };
  const setGhost = (id: string, element: HTMLElement | null) => {
    if (element) ghostElements.current.set(id, element);
    else ghostElements.current.delete(id);
  };

  useEffect(() => {
    const sequence: AnimationSequence = [];
    const at = (
      element: HTMLElement | null | undefined,
      opacity: [number, number],
      start: number,
      duration: number,
    ) => {
      if (element) sequence.push([element, { opacity }, { at: start, duration }]);
    };
    const cardRect = (id: string) => {
      const element = cardElements.current.get(id);
      if (!element) return null;
      const { left, top, width, height } = element.getBoundingClientRect();
      const rect = { left, top, width, height };
      return isVisibleRect(rect) ? rect : null;
    };
    let lastPlay = 0;
    presentation.playedCards.forEach(({ card, source }, index) => {
      const element = cardElements.current.get(card.id);
      const target = cardRect(card.id);
      if (!element || !target) return;
      const start = index * PLAY_STAGGER_SECONDS;
      if (!reduced && source && battleTarget) {
        sequence.push([
          element,
          {
            x: [source.left - target.left, 0],
            y: [source.top - target.top, 0],
            scaleX: [source.width / target.width, 1],
            scaleY: [source.height / target.height, 1],
            opacity: [1, 1],
          },
          { at: start, duration: PLAY_MOVE_SECONDS, ease: 'easeInOut' },
        ]);
        lastPlay = Math.max(lastPlay, start + PLAY_MOVE_SECONDS);
      } else {
        at(element, [0, 1], start, PLAY_FADE_SECONDS);
        lastPlay = Math.max(lastPlay, start + PLAY_FADE_SECONDS);
      }
    });

    const enemyStart = lastPlay + DEFEAT_RECOGNITION_HOLD_SECONDS;
    const enemyArrival =
      enemyStart + (reduced || !oldEnemy || !pile ? PLAY_FADE_SECONDS : ENEMY_MOVE_SECONDS);
    if (enemyElement.current) {
      if (!reduced && oldEnemy && pile) {
        sequence.push([
          enemyElement.current,
          {
            x: [0, pile.left - oldEnemy.left],
            y: [0, pile.top - oldEnemy.top],
            scaleX: [1, pile.width / oldEnemy.width],
            scaleY: [1, pile.height / oldEnemy.height],
          },
          { at: enemyStart, duration: ENEMY_MOVE_SECONDS, ease: 'easeInOut' },
        ]);
        at(enemyElement.current, [1, 0], enemyArrival, PLAY_FADE_SECONDS);
      } else if (oldEnemy) {
        at(enemyElement.current, [1, 0], enemyStart, PLAY_FADE_SECONDS);
      }
    }
    if (pile && (reduced || !oldEnemy)) {
      const reveal = oldEnemy ? enemyArrival : enemyStart;
      at(enemyGhost.current, [0, 1], reveal, PLAY_FADE_SECONDS);
      at(enemyGhost.current, [1, 0], reveal + PLAY_FADE_SECONDS, PLAY_FADE_SECONDS);
    }

    const cleanupStart =
      enemyArrival + (pile && (reduced || !oldEnemy) ? 2 : 1) * PLAY_FADE_SECONDS;
    let lastCleanup = cleanupStart;
    presentation.battleCards.forEach(({ card }, index) => {
      const element = cardElements.current.get(card.id);
      const source = cardRect(card.id);
      const start = cleanupStart + index * CLEANUP_STAGGER_SECONDS;
      if (reduced) {
        // Keep the old battle legible until its turn, then show its arrival at Discard.
        if (source && element) at(element, [1, 0], start, CLEANUP_FADE_SECONDS);
        if (discard) {
          const arrival = start + CLEANUP_FADE_SECONDS;
          at(ghostElements.current.get(card.id), [0, 1], arrival, CLEANUP_FADE_SECONDS);
          at(
            ghostElements.current.get(card.id),
            [1, 0],
            arrival + CLEANUP_HOLD_SECONDS,
            CLEANUP_FADE_SECONDS,
          );
          lastCleanup = Math.max(
            lastCleanup,
            arrival + CLEANUP_HOLD_SECONDS + CLEANUP_FADE_SECONDS,
          );
        } else {
          lastCleanup = Math.max(lastCleanup, start + CLEANUP_FADE_SECONDS);
        }
      } else if (element && source && discard) {
        sequence.push([
          element,
          {
            x: [0, discard.left - source.left],
            y: [0, discard.top - source.top],
            scaleX: [1, discard.width / source.width],
            scaleY: [1, discard.height / source.height],
            opacity: [1, 1],
          },
          { at: start, duration: CLEANUP_MOVE_SECONDS, ease: 'easeInOut' },
        ]);
        lastCleanup = Math.max(lastCleanup, start + CLEANUP_MOVE_SECONDS);
      } else if (element && source) {
        at(element, [0, 1], start, CLEANUP_FADE_SECONDS);
        lastCleanup = Math.max(lastCleanup, start + CLEANUP_FADE_SECONDS);
      }
    });
    if (!reduced) {
      presentation.battleCards.forEach(({ card }) => {
        at(
          cardElements.current.get(card.id),
          [1, 0],
          lastCleanup + CLEANUP_HOLD_SECONDS,
          CLEANUP_FADE_SECONDS,
        );
      });
    }
    if (!sequence.length) {
      onComplete();
      return;
    }
    let mounted = true;
    const controls = animate(sequence);
    void controls.then(
      () => {
        if (mounted) onComplete();
      },
      () => {},
    );
    return () => {
      mounted = false;
      controls.stop();
    };
    // Geometry is frozen for this mounted presentation; destination anchors are read after flushSync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, presentation, reduced, scope]);

  return (
    <div ref={scope} aria-hidden="true">
      {enemyPosition && (
        <div
          ref={enemyElement}
          className={`absolute origin-top-left ${oldEnemy ? '' : 'opacity-0'}`}
          style={{ left: enemyPosition.left, top: enemyPosition.top, zIndex: 50 }}
        >
          <PlayingCard card={presentation.enemy.card} variant="enemy" />
        </div>
      )}
      {pile && (reduced || !oldEnemy) && (
        <div
          ref={enemyGhost}
          className="absolute opacity-0"
          style={{ left: pile.left, top: pile.top, zIndex: 50 }}
        >
          <PlayingCard card={presentation.enemy.card} variant="pile" />
        </div>
      )}
      {[...oldCards, ...looseCards].map(
        ({ card, position }) =>
          position && (
            <div
              key={card.card.id}
              ref={(element) => setCard(card.card.id, element)}
              className={`absolute origin-top-left ${card.source ? '' : 'opacity-0'}`}
              style={{
                left: position.left,
                top: position.top,
                zIndex:
                  51 +
                  presentation.battleCards.findIndex((entry) => entry.card.id === card.card.id),
              }}
            >
              <PlayingCard card={card.card} variant="played" />
            </div>
          ),
      )}
      {battleTarget && (
        <div
          className="absolute flex -translate-x-1/2 gap-0.5"
          style={{
            left: battleTarget.left + battleTarget.width / 2,
            top: battleTarget.top,
            zIndex: 51 + oldCards.length,
          }}
        >
          {presentation.battleCards
            .filter((card) => card.newlyPlayed)
            .map(({ card }, index) => (
              <div
                key={card.id}
                ref={(element) => setCard(card.id, element)}
                className="relative origin-top-left opacity-0"
                style={{ zIndex: index }}
              >
                <PlayingCard card={card} variant="played" />
              </div>
            ))}
        </div>
      )}
      {reduced &&
        discard &&
        presentation.battleCards.map(({ card }, index) => (
          <div
            key={`ghost:${card.id}`}
            ref={(element) => setGhost(card.id, element)}
            className="absolute opacity-0"
            style={{ left: discard.left, top: discard.top, zIndex: 70 + index }}
          >
            <PlayingCard card={card} variant="pile" />
          </div>
        ))}
    </div>
  );
}
