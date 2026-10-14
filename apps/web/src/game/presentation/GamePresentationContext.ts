import type { GameEvent, GameView } from '@regicide/protocol';
import { createContext, useContext } from 'react';
import type { GamePresentationAnchorKey } from './game-presentation.types.ts';
import type { PileCounts } from './pile-display.ts';

export type GamePresentationContextValue = {
  registerAnchor: (key: GamePresentationAnchorKey, element: HTMLElement | null) => void;
  displayedPiles: PileCounts | null;
  displayedHandCounts: Readonly<Record<string, number>> | null;
  cancelPresentations: () => void;
  presentUpdate: (
    gameId: string,
    revision: number,
    events: readonly GameEvent[],
    localPlayerId: string,
    commitView: () => void,
    consecutiveViews: { previous: GameView; incoming: GameView } | null,
  ) => void;
  switchSession: (sessionKey: string | null) => void;
};

export const GamePresentationContext = createContext<GamePresentationContextValue | null>(null);

export function useGamePresentation(): GamePresentationContextValue {
  const presentation = useContext(GamePresentationContext);
  if (!presentation) {
    throw new Error('GamePresentationProvider is required');
  }
  return presentation;
}
