import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import type { Action } from '@regicide/game-engine';
import { attempt, current, DivergenceError, exportReproduction, replay, start } from './driver.ts';
import { diff } from './diff.ts';
import { compact, hint, show, showJson, summary, traceRow } from './output.ts';
import {
  loadReproduction,
  loadSession,
  saveSession,
  StorageError,
  withSessionLock,
  writeReproduction,
} from './storage.ts';

const help: Record<string, { usage: string; description: string; examples: string[] }> = {
  new: {
    usage: 'new --players <id,id,...> --seed <uint32>',
    description: 'Start a deterministic game. Both flags required; replaces the current session.',
    examples: [
      'pnpm game new --players alice --seed 42',
      'pnpm game new --players alice,bob,carol --seed 0',
    ],
  },
  state: {
    usage: 'state',
    description: 'Show compact current state (also the default command).',
    examples: ['pnpm game', 'pnpm game state'],
  },
  play: {
    usage: 'play --cards <card-id,...> [--player <id>]',
    description: 'Attempt a play-cards action. Player defaults to current player.',
    examples: [
      'pnpm game play --cards number-7-spades',
      'pnpm game play --cards number-2-clubs,number-2-hearts --player alice',
    ],
  },
  discard: {
    usage: 'discard --cards <card-id,...> [--player <id>]',
    description: 'Attempt a discard-for-damage action. Player defaults to current player.',
    examples: [
      'pnpm game discard --cards number-8-clubs',
      "pnpm game discard --cards '' (zero damage only)",
    ],
  },
  yield: {
    usage: 'yield [--player <id>]',
    description: 'Attempt a yield action. Player defaults to current player.',
    examples: ['pnpm game yield', 'pnpm game yield --player bob'],
  },
  'solo-jester': {
    usage: 'solo-jester [--player <id>]',
    description: 'Attempt a use-solo-jester action. Player defaults to current player.',
    examples: ['pnpm game solo-jester', 'pnpm game solo-jester --player alice'],
  },
  'accept-defeat': {
    usage: 'accept-defeat [--player <id>]',
    description: 'Accept unavoidable damage when a solo Jester is still available.',
    examples: ['pnpm game accept-defeat', 'pnpm game accept-defeat --player alice'],
  },
  'choose-player': {
    usage: 'choose-player --target <id> [--player <id>]',
    description: 'Attempt a choose-next-player action. Player defaults to current player.',
    examples: [
      'pnpm game choose-player --target bob',
      'pnpm game choose-player --target alice --player bob',
    ],
  },
  trace: {
    usage: 'trace [--all]',
    description: 'Show the last 20 attempted actions; --all shows the complete history.',
    examples: ['pnpm game trace', 'pnpm game trace --all'],
  },
  snapshot: {
    usage: 'snapshot [number] [--full]',
    description:
      'Show a numbered accepted state (latest by default). --full prints complete GameState as JSON.',
    examples: ['pnpm game snapshot', 'pnpm game snapshot 0 --full', 'pnpm game snapshot --full'],
  },
  diff: {
    usage: 'diff <from> <to> [--all]',
    description:
      'Compare successful snapshots by structural path. Shows first 20 changes unless --all.',
    examples: ['pnpm game diff 0 1', 'pnpm game diff 1 2 --all'],
  },
  export: {
    usage: 'export <path>',
    description: 'Write a portable reproduction as JSON; never overwrite an existing file.',
    examples: ['pnpm game export /tmp/regicide-repro.json', 'pnpm game export repro.json'],
  },
  replay: {
    usage: 'replay <path> [--activate]',
    description:
      'Re-execute and verify exported actions. Read-only unless --activate replaces the session after exact replay.',
    examples: ['pnpm game replay repro.json', 'pnpm game replay repro.json --activate'],
  },
};

type Exit = 1 | 2;
class CliFailure extends Error {
  readonly code: string;
  readonly exit: Exit;
  readonly next: string[] | undefined;
  constructor(code: string, message: string, exit: Exit, next?: string[]) {
    super(message);
    this.code = code;
    this.exit = exit;
    this.next = next;
  }
}
function usage(message: string, command?: string): never {
  throw new CliFailure('usage', message, 2, [
    command ? `pnpm game ${command} --help` : 'pnpm game --help',
  ]);
}
function integer(text: string, label: string, max: number): number {
  if (!/^(0|[1-9]\d*)$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) > max) {
    return usage(
      `${label} must be a non-negative decimal integer${max === 0xffffffff ? ' (0 to 4294967295)' : ''}`,
    );
  }
  return Number(text);
}
function required(value: string | boolean | undefined, flag: string, command: string): string {
  if (typeof value !== 'string' || value.length === 0)
    return usage(`Missing or empty ${flag}`, command);
  return value;
}
function list(value: string | boolean | undefined, flag: string, command: string): string[] {
  const parts = required(value, flag, command).split(',');
  if (parts.some((part) => part.length === 0 || part.trim() !== part)) {
    return usage(
      `${flag} must be comma-separated nonempty IDs without surrounding spaces`,
      command,
    );
  }
  return parts;
}
function optionsFor(command: string): ParseArgsOptionsConfig {
  const opts: ParseArgsOptionsConfig = { help: { type: 'boolean' } };
  if (command === 'new') {
    opts.players = { type: 'string' };
    opts.seed = { type: 'string' };
  } else if (command === 'play' || command === 'discard') {
    opts.cards = { type: 'string' };
    opts.player = { type: 'string' };
  } else if (command === 'choose-player') {
    opts.target = { type: 'string' };
    opts.player = { type: 'string' };
  } else if (['yield', 'solo-jester', 'accept-defeat'].includes(command)) {
    opts.player = { type: 'string' };
  } else if (command === 'snapshot') {
    opts.full = { type: 'boolean' };
  } else if (command === 'trace' || command === 'diff') {
    opts.all = { type: 'boolean' };
  } else if (command === 'replay') {
    opts.activate = { type: 'boolean' };
  }
  return opts;
}
function parse(
  command: string,
  args: string[],
): { values: Record<string, string | boolean | undefined>; positionals: string[] } {
  try {
    const { values, positionals, tokens } = parseArgs({
      args,
      options: optionsFor(command),
      allowPositionals: true,
      strict: true,
      tokens: true,
    });
    const seen = new Set<string>();
    for (const token of tokens) {
      if (token.kind !== 'option') continue;
      if (seen.has(token.name)) usage(`Repeated flag: --${token.name}`, command);
      seen.add(token.name);
    }
    const checked: Record<string, string | boolean | undefined> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && typeof value !== 'string' && typeof value !== 'boolean') {
        usage(`Invalid value for --${key}`, command);
      }
      checked[key] = value;
    }
    return { values: checked, positionals };
  } catch (error) {
    return usage(error instanceof Error ? error.message : String(error), command);
  }
}
function positional(args: string[], count: number, command: string): void {
  if (args.length !== count)
    usage(`Expected ${count} positional argument${count === 1 ? '' : 's'} for ${command}`, command);
}
function requireSession() {
  const session = loadSession();
  if (!session)
    throw new CliFailure('no-session', 'No verification session exists', 1, [
      'pnpm game new --players alice --seed 42',
    ]);
  return session;
}
function commandHelp(command?: string): void {
  if (!command) {
    show({
      tool: 'Regicide engine verification CLI',
      usage: 'pnpm game [command] [options]',
      commands: Object.keys(help),
      default: 'pnpm game shows live state',
      examples: [
        'pnpm game new --players alice --seed 42',
        'pnpm game snapshot --full',
        'pnpm game help play',
      ],
    });
    return;
  }
  const item = help[command];
  if (!item) usage(`Unknown command: ${command}`);
  show({
    command,
    usage: `pnpm game ${item.usage}`,
    description: item.description,
    flags: [
      '--help',
      ...Object.entries(optionsFor(command))
        .filter(([key]) => key !== 'help')
        .map(([key]) => `--${key}`),
    ],
    examples: item.examples,
  });
}
function actionFor(
  command: string,
  values: Record<string, string | boolean | undefined>,
  playerId: string,
): Action {
  switch (command) {
    case 'play':
      return { kind: 'play-cards', playerId, cardIds: list(values.cards, '--cards', command) };
    case 'discard':
      return {
        kind: 'discard-for-damage',
        playerId,
        cardIds: values.cards === '' ? [] : list(values.cards, '--cards', command),
      };
    case 'yield':
      return { kind: 'yield', playerId };
    case 'solo-jester':
      return { kind: 'use-solo-jester', playerId };
    case 'accept-defeat':
      return { kind: 'accept-defeat', playerId };
    case 'choose-player':
      return {
        kind: 'choose-next-player',
        playerId,
        targetPlayerId: required(values.target, '--target', command),
      };
    default:
      return usage(`Unknown action: ${command}`);
  }
}

function main(args: string[]): void {
  const [first, ...tail] = args;
  if (first === '--help') {
    positional(tail, 0, 'help');
    commandHelp();
    return;
  }
  if (first === 'help') {
    positional(tail, tail.length > 0 ? 1 : 0, 'help');
    commandHelp(tail[0]);
    return;
  }
  const command = first ?? 'state';
  if (!help[command]) usage(`Unknown command: ${command}`);
  const { values, positionals } = parse(command, tail);
  if (values.help) {
    positional(positionals, 0, command);
    commandHelp(command);
    return;
  }
  switch (command) {
    case 'new': {
      positional(positionals, 0, command);
      const playerIds = list(values.players, '--players', command);
      const rngState = integer(required(values.seed, '--seed', command), '--seed', 0xffffffff);
      withSessionLock(() => {
        let session;
        try {
          session = start({ playerIds, rngState });
        } catch (error) {
          throw new CliFailure(
            'setup-rejected',
            error instanceof Error ? error.message : String(error),
            1,
          );
        }
        saveSession(session);
        show({ ...summary(session), help: hint(current(session)) });
      });
      break;
    }
    case 'state': {
      positional(positionals, 0, command);
      const session = loadSession();
      if (session) show({ ...summary(session), help: hint(current(session)) });
      else show({ session: 'none', help: ['pnpm game new --players alice --seed 42'] });
      break;
    }
    case 'play':
    case 'discard':
    case 'yield':
    case 'solo-jester':
    case 'accept-defeat':
    case 'choose-player': {
      positional(positionals, 0, command);
      // Validate all CLI syntax before invoking transition, including when there is no session.
      if (command === 'play' || (command === 'discard' && values.cards !== '')) {
        list(values.cards, '--cards', command);
      }
      if (command === 'choose-player') required(values.target, '--target', command);
      if (values.player !== undefined) required(values.player, '--player', command);
      withSessionLock(() => {
        const session = requireSession();
        const action = actionFor(
          command,
          values,
          typeof values.player === 'string' ? values.player : current(session).world.currentPlayer,
        );
        const entry = attempt(session, action);
        saveSession(session);
        if (entry.outcome === 'rejected') {
          show({
            error: { code: 'action-rejected', message: entry.error },
            action,
            state: { snapshot: session.snapshots.length - 1, ...compact(current(session)) },
            help: hint(current(session)),
          });
          process.exitCode = 1;
        } else {
          show({ action, result: 'accepted', ...summary(session), help: hint(current(session)) });
        }
      });
      break;
    }
    case 'snapshot': {
      if (positionals.length > 1) usage('Expected zero or one snapshot number', command);
      const requested =
        positionals[0] === undefined
          ? undefined
          : integer(positionals[0], 'snapshot number', Number.MAX_SAFE_INTEGER);
      const session = requireSession();
      const number = requested ?? session.snapshots.length - 1;
      const state = session.snapshots[number];
      if (!state)
        throw new CliFailure(
          'snapshot-not-found',
          `Snapshot ${number} does not exist (latest: ${session.snapshots.length - 1})`,
          1,
        );
      if (values.full) showJson(state);
      else
        show({
          snapshot: number,
          ...compact(state),
          help: [`pnpm game snapshot ${number} --full`],
        });
      break;
    }
    case 'trace': {
      positional(positionals, 0, command);
      const session = requireSession();
      const entries = values.all ? session.entries : session.entries.slice(-20);
      show({
        trace: {
          count: session.entries.length,
          accepted: session.snapshots.length - 1,
          rejected: session.entries.length - session.snapshots.length + 1,
          entries: entries.map(traceRow),
        },
        ...(!values.all && entries.length < session.entries.length
          ? { help: ['pnpm game trace --all'] }
          : {}),
      });
      break;
    }
    case 'diff': {
      positional(positionals, 2, command);
      const from = integer(positionals[0]!, 'from', Number.MAX_SAFE_INTEGER);
      const to = integer(positionals[1]!, 'to', Number.MAX_SAFE_INTEGER);
      const session = requireSession();
      if (!session.snapshots[from] || !session.snapshots[to])
        throw new CliFailure(
          'snapshot-not-found',
          `Snapshots available: 0 to ${session.snapshots.length - 1}`,
          1,
        );
      const changes = diff(session.snapshots[from], session.snapshots[to]);
      show({
        from,
        to,
        changes: { count: changes.length, entries: values.all ? changes : changes.slice(0, 20) },
        ...(!values.all && changes.length > 20
          ? { help: [`pnpm game diff ${from} ${to} --all`] }
          : {}),
      });
      break;
    }
    case 'export': {
      positional(positionals, 1, command);
      if (!positionals[0]) usage('Export path must not be empty', command);
      const session = requireSession();
      writeReproduction(positionals[0], exportReproduction(session));
      show({
        export: positionals[0],
        seed: session.setup.rngState,
        attempts: session.entries.length,
      });
      break;
    }
    case 'replay': {
      positional(positionals, 1, command);
      if (!positionals[0]) usage('Replay path must not be empty', command);
      const reproduction = loadReproduction(positionals[0]);
      const verify = () => {
        const session = replay(reproduction);
        if (values.activate) saveSession(session);
        show({
          replay: 'exact',
          seed: session.setup.rngState,
          attempts: session.entries.length,
          snapshots: session.snapshots.length,
          activated: Boolean(values.activate),
        });
      };
      if (values.activate) withSessionLock(verify);
      else verify();
      break;
    }
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  if (error instanceof CliFailure) {
    show({
      error: { code: error.code, message: error.message },
      ...(error.next ? { help: error.next } : {}),
    });
    process.exitCode = error.exit;
  } else if (error instanceof StorageError) {
    show({ error: { code: error.code, message: error.message } });
    process.exitCode = 1;
  } else if (error instanceof DivergenceError) {
    show({ error: { code: 'replay-diverged', message: error.message, sequence: error.sequence } });
    process.exitCode = 1;
  } else {
    show({
      error: {
        code: 'operation-failed',
        message: error instanceof Error ? error.message : String(error),
      },
    });
    process.exitCode = 1;
  }
}
