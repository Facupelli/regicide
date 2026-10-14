import type { AnimationSequence } from 'motion/react';

export function appendArrival(sequence: AnimationSequence, at: number, arrived: () => void) {
  let fired = false;
  sequence.push([
    (progress: number) => {
      if (!fired && progress >= 0.5) {
        fired = true;
        arrived();
      }
    },
    [0, 1],
    { at, duration: 0.001, ease: 'linear' },
  ]);
}
