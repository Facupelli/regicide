import type { GameView, PlayerCommand } from '@regicide/protocol';

export type TableProps = {
  view: GameView;
  selectedCardIds: string[];
  onToggleCard: (cardId: string) => void;
  onAction: (command: PlayerCommand) => void;
  onNewGame: () => void;
  actionPending: boolean;
  actionsDisabled: boolean;
  actionError: string | null;
};
