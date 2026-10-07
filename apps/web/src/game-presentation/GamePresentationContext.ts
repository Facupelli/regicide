import type { GameEvent } from '@regicide/protocol';
import { createContext, useContext } from 'react';
import type {
  GamePresentationAnchorKey,
  PreparedGamePresentation,
} from './game-presentation.types.ts';

export type GamePresentationContextValue = {
  registerAnchor: (key: GamePresentationAnchorKey, element: HTMLElement | null) => void;
  prepare: (events: readonly GameEvent[], localPlayerId: string) => PreparedGamePresentation[];
  enqueue: (presentations: readonly PreparedGamePresentation[]) => void;
  reset: () => void;
};

export const GamePresentationContext = createContext<GamePresentationContextValue | null>(null);

export function useGamePresentation(): GamePresentationContextValue {
  const presentation = useContext(GamePresentationContext);
  if (!presentation) throw new Error('GamePresentationProvider is required');
  return presentation;
}
