import { readFileSync } from 'node:fs';

try {
  const output = readFileSync(0, 'utf8');
  const match = output.match(/^result: (.+)$/m);
  if (!match) {
    throw new Error('AXI eval returned no result');
  }
  const state = JSON.parse(JSON.parse(match[1]));
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('AXI eval returned an invalid game state');
  }
  process.stdout.write(`${JSON.stringify(state)}\n`);
} catch (error) {
  console.error(`GAME_STATE_PROTOCOL_ERROR: ${error.message}`);
  process.exitCode = 1;
}
