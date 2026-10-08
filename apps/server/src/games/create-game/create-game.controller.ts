import type { CreateGameResponse } from '@regicide/protocol';
import type { Context } from 'hono';
import { createGame as createGameOperation } from './create-game.ts';

export function createGame(c: Context) {
  const result = createGameOperation();
  c.header('Location', `/games/${result.gameId}`);
  return c.json(result satisfies CreateGameResponse, 201);
}
