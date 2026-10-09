import { destroyAgentRuntime } from '../agents/agent-runtime/agent-runtime.ts';
import type { GameSession } from './game-session.ts';

class GameStore extends Map<string, GameSession> {
  override delete(gameId: string): boolean {
    destroyAgentRuntime(gameId);
    return super.delete(gameId);
  }

  override clear(): void {
    for (const gameId of this.keys()) {
      this.delete(gameId);
    }
  }
}

export const gameStore = new GameStore();
