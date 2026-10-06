import { encode } from '@toon-format/toon';
import {
  canAcceptDefeat,
  canUseSoloJester,
  soloVictoryRank,
  type GameState,
} from '@regicide/game-engine';
import { current, type Entry, type Session } from './driver.ts';

export function show(value: unknown): void {
  process.stdout.write(`${encode(value)}\n`);
}

export function showJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function compact(state: GameState): Record<string, unknown> {
  const player = state.world.players.find(
    (candidate) => candidate.id === state.world.currentPlayer,
  );
  const view: Record<string, unknown> = {
    status: state.kind,
    ...(state.kind === 'active' ? { decision: state.decision.kind } : { result: state.result }),
    ...(state.kind === 'game-over' && state.result === 'win'
      ? { soloVictoryRank: soloVictoryRank(state) }
      : {}),
    player: {
      id: state.world.currentPlayer,
      hand: player?.hand.length ?? 0,
      cards: player?.hand.map((card) => card.id) ?? [],
    },
    ...(state.kind === 'active' || state.result === 'loss'
      ? {
          battle: {
            enemy: state.world.battle.enemy.id,
            damageDealt: state.world.battle.damageDealt,
          },
        }
      : {}),
    zones: {
      tavern: state.world.tavern.length,
      discard: state.world.discard.length,
      castle: state.world.castle.length,
    },
  };
  if (state.kind === 'active' && state.decision.kind === 'await-retaliation-action') {
    view.requiredDamage = state.decision.requiredDamage;
  }
  if (state.world.soloJestersUsed !== null) view.soloJestersUsed = state.world.soloJestersUsed;
  return view;
}

export function summary(
  session: Session,
  state: GameState = current(session),
): Record<string, unknown> {
  return {
    session: `${session.setup.playerIds.join(',')}@${session.setup.rngState}`,
    seed: session.setup.rngState,
    snapshot: session.snapshots.indexOf(state),
    actionsAccepted: session.snapshots.length - 1,
    actionsRejected: session.entries.length - session.snapshots.length + 1,
    ...compact(state),
  };
}

export function hint(state: GameState): string[] {
  if (state.kind === 'game-over')
    return ['pnpm game trace', 'pnpm game new --players alice --seed 42'];
  switch (state.decision.kind) {
    case 'await-turn-action':
      return ['pnpm game help play', 'pnpm game help yield', 'pnpm game help solo-jester'];
    case 'await-retaliation-action':
      return [
        state.decision.requiredDamage === 0
          ? "pnpm game discard --cards ''"
          : 'pnpm game discard --cards <card-id,...>',
        ...(canUseSoloJester(state) ? ['pnpm game solo-jester'] : []),
        ...(canAcceptDefeat(state) ? ['pnpm game accept-defeat'] : []),
      ];
    case 'await-next-player-choice':
      return ['pnpm game choose-player --target <player-id>'];
  }
  return [];
}

export function traceRow(entry: Entry): Record<string, unknown> {
  return {
    sequence: entry.sequence,
    action: entry.action,
    result: entry.outcome,
    ...(entry.outcome === 'accepted' ? { snapshot: entry.snapshotAfter } : { error: entry.error }),
  };
}
