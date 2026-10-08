import type { CreateGameResponse } from '@regicide/protocol';
import type { Context } from 'hono';
import { gameService } from '../game-service.ts';

export function createGame(c: Context) {
  const result = gameService.createGame();
  c.header('Location', `/games/${result.gameId}`);
  return c.json(result satisfies CreateGameResponse, 201);
}
