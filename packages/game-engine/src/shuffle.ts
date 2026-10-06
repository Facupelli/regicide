// Fisher-Yates on a copy; the LCG state is threaded through each shuffle, never global.
export function shuffle<T>(
  cards: readonly T[],
  rngState: number,
): { cards: T[]; rngState: number } {
  const shuffled = [...cards];
  let nextState = rngState;
  for (let index = shuffled.length - 1; index > 0; index--) {
    nextState = (Math.imul(nextState, 1664525) + 1013904223) >>> 0;
    const otherIndex = Math.floor((nextState / 0x100000000) * (index + 1));
    const card = shuffled[index]!;
    shuffled[index] = shuffled[otherIndex]!;
    shuffled[otherIndex] = card;
  }
  return { cards: shuffled, rngState: nextState };
}
