import type { Card, Suit } from '@regicide/protocol';
import { cardLabel } from './card-label.ts';

type CardVariant = 'hand' | 'enemy' | 'played' | 'pile';

const suitMarks: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

const sizes: Record<CardVariant, string> = {
  hand: 'w-[var(--hand-card-width,clamp(4.5rem,19vw,6.5rem))] shrink-0 lg:w-[clamp(4rem,6.4vw,5.5rem)]',
  enemy: 'w-[clamp(5rem,12svh,6rem)] sm:w-[clamp(5rem,12svh,9rem)] lg:w-36',
  played: 'w-16 shrink-0 sm:w-18 lg:w-16',
  pile: 'w-[var(--pile-card-width,2.5rem)] sm:w-[var(--pile-card-width,3rem)]',
};

const suitSizes: Record<CardVariant, string> = {
  enemy: 'text-6xl',
  hand: 'text-4xl',
  played: 'text-2xl',
  pile: 'text-2xl',
};

function rankMark(card: Card | undefined) {
  switch (card?.kind) {
    case 'number':
      return String(card.rank);
    case 'royal':
      return card.rank.charAt(0).toUpperCase();
    case 'animal':
      return 'A';
    default:
      return '★';
  }
}

function cardTextColor(card: Card) {
  if (card.kind === 'jester') {
    return 'text-card-foreground';
  }
  return card.suit === 'hearts' || card.suit === 'diamonds' ? 'text-suit-red' : 'text-suit-black';
}

function cardKindLabel(card: Card) {
  switch (card.kind) {
    case 'animal':
      return 'Animal';
    case 'jester':
      return 'Jester';
    default:
      return card.rank;
  }
}

const cardStates = {
  normal: 'border-card-border',
  selected:
    '-translate-y-6 border-card-selected ring-2 ring-card-selected ring-offset-2 ring-offset-table lg:-translate-y-2',
  unavailable: 'cursor-not-allowed border-dashed border-card-unavailable opacity-50 grayscale',
  pending: 'cursor-wait opacity-60',
} as const;

export function PlayingCard({
  card,
  variant,
  label,
  selected = false,
  unavailableReason,
  disabled = false,
  onToggle,
  elementRef,
}: {
  card?: Card;
  variant: CardVariant;
  label?: string;
  selected?: boolean;
  unavailableReason?: string | undefined;
  disabled?: boolean;
  onToggle?: (() => void) | undefined;
  elementRef?: (element: HTMLElement | null) => void;
}) {
  const rank = rankMark(card);
  const suit = card && card.kind !== 'jester' ? suitMarks[card.suit] : '✦';
  const name = card ? cardLabel(card) : (label ?? 'Card back');
  let state: keyof typeof cardStates = 'normal';
  if (selected) {
    state = 'selected';
  } else if (unavailableReason) {
    state = 'unavailable';
  }
  const classes = [
    'relative flex aspect-[5/7] flex-col items-center justify-center overflow-hidden rounded-lg border-2 shadow-md',
    sizes[variant],
    cardStates[state],
    card ? 'bg-card' : 'bg-muted text-muted-foreground',
    card && cardTextColor(card),
    variant === 'hand' &&
      'transition-[transform,box-shadow,opacity] duration-150 motion-reduce:transition-none',
    onToggle &&
      !disabled &&
      !unavailableReason &&
      `cursor-pointer hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected ${selected ? 'lg:hover:-translate-y-1' : 'hover:-translate-y-1'}`,
    disabled && cardStates.pending,
  ]
    .filter(Boolean)
    .join(' ');
  const face = card ? (
    <>
      <span
        className="absolute top-1 left-1 flex flex-col items-center text-xs leading-none font-bold sm:top-2 sm:left-2 sm:text-sm"
        aria-hidden="true"
      >
        {rank}
        <span>{suit}</span>
      </span>
      <span className={suitSizes[variant]} aria-hidden="true">
        {suit}
      </span>
      {variant !== 'pile' &&
        (card.kind === 'animal' || card.kind === 'jester' || card.kind === 'royal') && (
          <span
            className="absolute bottom-1 w-full truncate px-1 text-center text-[0.55rem] font-semibold uppercase sm:bottom-2 sm:text-xs"
            aria-hidden="true"
          >
            {cardKindLabel(card)}
          </span>
        )}
    </>
  ) : (
    <span className="text-xl" aria-hidden="true">
      ✦
    </span>
  );

  if (onToggle) {
    return (
      <button
        ref={elementRef}
        type="button"
        className={classes}
        data-verify={variant === 'hand' && card ? 'hand-card' : undefined}
        aria-label={`${name}${unavailableReason ? `, unavailable: ${unavailableReason}` : ''}`}
        aria-pressed={selected}
        aria-disabled={Boolean(unavailableReason) || disabled}
        disabled={disabled}
        onClick={() => {
          if (!unavailableReason && !disabled) {
            onToggle();
          }
        }}
      >
        {face}
      </button>
    );
  }
  return (
    <span
      ref={elementRef}
      className={classes}
      role="img"
      aria-label={name}
      data-verify={
        card && variant !== 'pile'
          ? `${variant === 'played' ? 'current-play' : variant}-card`
          : undefined
      }
    >
      {face}
    </span>
  );
}
