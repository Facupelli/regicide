export default function gameState() {
  const game = document.querySelector('[data-verify="game"]');
  if (!game) {
    throw new Error('GAME_STATE_UNAVAILABLE');
  }

  const phase = game.getAttribute('data-phase');
  if (phase === 'victory' || phase === 'defeat') {
    throw new Error(`GAME_STATE_UNSUPPORTED: ${phase}`);
  }

  // Helpers must be inside the function sent to the browser.
  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const broken = (reason) => {
    throw new Error(`GAME_STATE_CONTRACT_BROKEN: ${reason}`);
  };
  const one = (name, root = game) => {
    const elements = root.querySelectorAll(`[data-verify="${name}"]`);
    if (elements.length !== 1) {
      return broken(elements.length ? `duplicate ${name}` : `missing ${name}`);
    }
    return elements[0];
  };
  const number = (name, pattern = /^\d+$/) => {
    const value = one(name).innerText.trim();
    const match = value.match(pattern);
    if (!match) {
      return broken(`invalid ${name}: ${value}`);
    }
    const result = Number(match[1] ?? match[0]);
    return Number.isSafeInteger(result) ? result : broken(`invalid ${name}: ${value}`);
  };
  const cardName = (element, name, pattern) => {
    const label = element.getAttribute('aria-label');
    if (!label || !pattern.test(label)) {
      return broken(`invalid ${name} label: ${label}`);
    }
    return label;
  };

  if (!['play', 'discard', 'waiting', 'choose-next-player'].includes(phase)) {
    return broken('invalid phase');
  }
  const turn = game.getAttribute('data-turn');
  if (turn !== 'you' && turn !== 'other') {
    return broken('invalid turn');
  }

  const decision = one('decision').innerText.replace(/\s+/g, ' ').trim();
  if (!decision) {
    return broken('empty decision');
  }

  let selected = null;
  let required = null;
  if (phase === 'discard') {
    const selectedDamage = game.querySelectorAll('[data-verify="selected-damage"]');
    const requiredDamage = game.querySelectorAll('[data-verify="required-damage"]');
    const zeroDamage = game.querySelectorAll('[data-verify="zero-damage"]');
    if (selectedDamage.length !== requiredDamage.length) {
      return broken('incomplete damage values');
    }
    if (selectedDamage.length > 1) {
      return broken('duplicate damage values');
    }
    if (zeroDamage.length > 1) {
      return broken('duplicate zero-damage');
    }
    if (selectedDamage.length === 1) {
      if (zeroDamage.length) {
        return broken('conflicting damage values');
      }
      selected = number('selected-damage');
      required = number('required-damage');
    } else if (!zeroDamage.length) {
      return broken('missing damage values or zero-damage');
    }
  }

  const playArea = one('current-play');
  const visiblePlays = [...playArea.querySelectorAll('[role="img"]')];
  const playCards = [...playArea.querySelectorAll('[data-verify="current-play-card"]')];
  if (
    visiblePlays.length !== playCards.length ||
    visiblePlays.some((card, index) => card !== playCards[index])
  ) {
    return broken('missing or invalid current-play-card');
  }
  const currentPlay = playCards.map((card) =>
    cardName(
      card,
      'current-play-card',
      /^(?:(?:[2-9]|10|jack|queen|king|Animal Companion) of (?:clubs|diamonds|hearts|spades)|Jester)$/,
    ),
  );

  const otherPlayers = [...one('other-players').querySelectorAll('[aria-label]')]
    .filter((seat) => seat.getAttribute('aria-label').startsWith('Player '))
    .map((seat) => {
      const count = one('other-player-hand-count', seat);
      const value = count.innerText.trim();
      const match = value.match(/^(\d+) cards$/);
      if (!match || !Number.isSafeInteger(Number(match[1]))) {
        return broken(`invalid other-player-hand-count: ${value}`);
      }
      return { handCount: Number(match[1]) };
    });

  return {
    phase,
    turn,
    decision,
    enemy: {
      card: cardName(
        one('enemy-card'),
        'enemy-card',
        /^(?:jack|queen|king) of (?:clubs|diamonds|hearts|spades)$/,
      ),
      health: number('enemy-health', /^(\d+)\s*\/\s*\d+$/),
      attack: number('enemy-attack'),
      shield: number('enemy-shield'),
    },
    hand: [...game.querySelectorAll('[data-verify="hand-card"]')].map((card) => {
      const label = card.getAttribute('aria-label');
      if (!label) {
        return broken('missing hand-card label');
      }
      const name = label.split(', unavailable: ')[0];
      if (card instanceof HTMLButtonElement && !card.hasAttribute('aria-pressed')) {
        return broken('missing hand-card aria-pressed');
      }
      return {
        card: name,
        selected: card.getAttribute('aria-pressed') === 'true',
        disabled:
          !(card instanceof HTMLButtonElement) ||
          card.disabled ||
          card.getAttribute('aria-disabled') === 'true',
      };
    }),
    damage: { selected, required },
    currentPlay,
    otherPlayers,
  };
}
