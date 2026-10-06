type PlayerCountRules = Readonly<{ handLimit: number; jesterCount: number }>;

const PLAYER_COUNT_RULES: Readonly<Record<number, PlayerCountRules>> = {
  1: { handLimit: 8, jesterCount: 0 },
  2: { handLimit: 7, jesterCount: 0 },
  3: { handLimit: 6, jesterCount: 1 },
  4: { handLimit: 5, jesterCount: 2 },
};

export function playerCountRules(playerCount: number): PlayerCountRules {
  const rules = PLAYER_COUNT_RULES[playerCount];
  if (!rules) throw new Error('Only games with 1 to 4 players are supported');
  return rules;
}

export function maxHandSize(playerCount: number): number {
  return playerCountRules(playerCount).handLimit;
}
