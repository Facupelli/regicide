import type { Action } from '@regicide/game-engine';
import type { PlayerCommand } from '@regicide/protocol';

export function toEngineAction(command: PlayerCommand, playerId: string): Action {
  switch (command.kind) {
    case 'play-cards':
      return { kind: 'play-cards', playerId, cardIds: [...command.cardIds] };
    case 'yield':
      return { kind: 'yield', playerId };
    case 'discard-for-damage':
      return { kind: 'discard-for-damage', playerId, cardIds: [...command.cardIds] };
    case 'choose-next-player':
      return { kind: 'choose-next-player', playerId, targetPlayerId: command.targetPlayerId };
    case 'use-solo-jester':
      return { kind: 'use-solo-jester', playerId };
    case 'accept-defeat':
      return { kind: 'accept-defeat', playerId };
  }
  return assertNever(command);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported player command: ${JSON.stringify(value)}`);
}
