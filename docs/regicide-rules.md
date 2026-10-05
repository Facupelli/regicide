# Regicide — Rules

## Aim of the Game

Regicide is a cooperative game where players work together to defeat 12 powerful enemies.

Players take turns playing cards to attack the current enemy. Once enough damage is dealt, the enemy is defeated. The players win when the last King is defeated.

Each turn, however, the enemy strikes back. Players must discard cards to satisfy the damage. If a player cannot discard enough, everyone loses.

---

## Setup

1. Shuffle the 4 Kings and place them facedown in a pile.
2. Shuffle the 4 Queens and place them facedown on top of the Kings.
3. Shuffle the 4 Jacks and place them facedown on top of the Queens.

This forms the **Castle deck**.

Place the Castle deck in the centre of the table and turn the top card face up to reveal a Jack. This becomes the current enemy.

Shuffle together:

- All cards numbered 2 to 10
- The 4 Animal Companions
- The required number of Jesters for the player count

These cards form the **Tavern deck**.

The Tavern deck is where cards are dealt and drawn from. During the game, place discarded cards into a shared discard pile beside the Tavern deck.

Deal cards to each player up to their maximum hand size.

| Players | Jesters | Max. Hand Size |
|---:|---:|---:|
| 1 | 0 | 8 |
| 2 | 0 | 7 |
| 3 | 1 | 6 |
| 4 | 2 | 5 |

The player who has most recently committed regicide goes first.

---

## How to Play

On their turn, a player plays cards from their hand to deal damage to the current enemy.

The values on the cards determine damage, while the suit provides a special power.

Each turn has four steps:

1. **Play a card or yield**
2. **Activate the suit power**
3. **Deal damage to the enemy and check**
4. **Suffer damage from the enemy**

---

## Step 1 — Play a Card or Yield

### Play a card from hand to attack the enemy

Play a card from your hand onto the table in front of you.

The number on the card determines its attack value. For example, a 7 of Hearts has an attack value of 7.

Instead of playing a card, a player may choose to **yield**.

---

## Step 2 — Activate the Played Card's Suit Power

Playing a card to damage the enemy also activates the power associated with that card's suit.

Powers from red suits are resolved immediately. Powers from black suits take effect in later steps.

### Hearts — Heal from the discard

Shuffle the discard pile.

Count out a number of cards facedown equal to the attack value played and place them under the Tavern deck without looking at them.

Then return the discard pile to the table face up.

### Diamonds — Draw cards

The current player draws a card.

The other players follow in clockwise order, drawing one card at a time until a number of cards equal to the attack value played have been drawn.

Players who have reached their maximum hand size are skipped.

Players may never draw cards above their maximum hand size.

There is no penalty if the Tavern deck becomes empty before all possible cards are drawn.

### Clubs — Double damage

During Step 3, damage dealt by Clubs counts for double.

For example, the 8 of Clubs deals 16 damage.

### Spades — Shield against enemy attack

During Step 4, reduce the attack value of the current enemy by the attack value played.

The shield effects of Spades are cumulative for all Spades played against the current enemy by any player.

These effects remain active until that enemy is defeated.

> Suit powers are mandatory and cannot be skipped.

---

## Step 3 — Deal Damage and Check Whether the Enemy Is Defeated

| Enemy | Attack | Health |
|---|---:|---:|
| Jack | 10 | 20 |
| Queen | 15 | 30 |
| King | 20 | 40 |

Deal damage to the enemy equal to the attack value of the card or cards played.

Track the total damage dealt by all players against the current enemy.

If the accumulated damage is equal to or greater than the enemy's health, the enemy is defeated.

For example, against a Jack, if one player deals 9 damage and another later deals 12 damage, the accumulated damage is 21, so the Jack is defeated.

### When an enemy is defeated

1. Place the enemy in the discard pile.
   - If the players dealt damage **exactly equal** to the enemy's health, place the defeated enemy **facedown on top of the Tavern deck instead**.
2. Place all cards played by players against that enemy in the discard pile.
3. Turn the next card of the Castle deck face up.
4. The player who defeated the enemy skips Step 4 and immediately begins a new turn against the newly revealed enemy, starting at Step 1.

---

## Step 4 — Suffer Damage from the Enemy

If the enemy was not defeated, it attacks the current player.

The enemy deals damage equal to its attack value, reduced by the total value of all active Spades played against it.

The current player must discard cards from their hand whose combined value is at least equal to the enemy's resulting attack value.

Discard the cards one at a time, face up, into the discard pile.

When discarded to absorb damage:

- Animal Companions have a value of **1**
- Jesters have a value of **0**

If the player cannot discard enough cards to satisfy the damage, that player dies and **all players lose the game**.

It is allowed to have an empty hand after suffering damage.

After resolving the damage, the next player in clockwise order begins their turn at Step 1.

---

## Animal Companions

During Step 1, an Animal Companion may be played on its own or paired with one other card, except a Jester.

An Animal Companion:

- Counts as **1** toward the attack total
- Applies its suit power

For example, playing the 8 of Diamonds together with the Animal Companion of Clubs creates an attack value of 9.

Both suit powers are then applied using that total:

- Draw 9 cards
- Deal 18 damage

Whenever Hearts and Diamonds are resolved together, resolve **Hearts first**, then Diamonds.

An Animal Companion may also be paired with another Animal Companion.

If an Animal Companion is played with another card of the same suit, that suit power is applied only once.

---

## Combos

During Step 1, instead of playing a single card, a player may combine cards of the same number into a set of 2, 3, or 4 cards, as long as their combined total is **10 or less**.

Valid examples include:

- Pair of 2s, 3s, 4s, or 5s
- Triple 2s or 3s
- Quadruple 2s

Animal Companions cannot be added to a combo and cannot form a combo by themselves.

They may only be paired with one other card, which may itself be another Animal Companion.

When cards are played as a combo, all suit powers are resolved using the combo's total attack value.

For example, playing the 3 of Diamonds, 3 of Spades, and 3 of Clubs together gives an attack value of 9:

- Diamonds draw 9 cards
- Spades reduce the enemy's attack by 9
- Clubs cause the attack to deal 18 damage

Whenever Hearts and Diamonds are resolved together, resolve **Hearts first**, then Diamonds.

---

## Enemy Immunity

Each enemy is immune to the suit power of cards that match the enemy's own suit.

For example, when fighting the Jack of Diamonds, playing a Diamond card does not cause cards to be drawn.

The card's attack value still counts toward damage.

The Jester can cancel an enemy's immunity.

---

## Playing the Jester

During Step 1, a Jester may be played instead of another card.

A Jester must always be played **on its own**.

The Jester has an attack value of **0**.

Its power negates the current enemy's suit immunity. From that point onward, cards whose suit matches the enemy's suit can apply their suit powers normally.

After playing a Jester:

1. Skip Steps 3 and 4.
2. The player who played the Jester chooses **any player** to take the next turn.

### Communication after a Jester

After a Jester is played, normal communication restrictions are temporarily relaxed.

Until the next player begins their turn, players may express their desire or reluctance to go next in a general way.

For example:

- "I have a good play."
- "I would rather not go next."

Players still may not reveal the contents of their hand.

### Interaction with earlier cards

If a Jester is played against a Spades enemy, Spades played before the Jester begin reducing that enemy's attack value.

However, Clubs played before the Jester against a Clubs enemy do **not** retroactively count for double damage.

---

## Drawing a Defeated Enemy

Defeated enemies that later enter a player's hand can be used like powerful cards.

Their values are:

| Card | Value |
|---|---:|
| Jack | 10 |
| Queen | 15 |
| King | 20 |

These values apply both when:

- Playing the card as an attack
- Discarding the card to suffer damage

When played as an attack, the card's suit power applies normally.

---

## Yielding

During Step 1, a player may choose to **yield** instead of playing a card.

To yield, say "Yield" and move directly to Step 4.

This skips Steps 2 and 3.

A player may not yield if every other player yielded on their previous turn.

For example, in a three-player game, if two players yield in a row, the third player may not yield.

---

## Communication

Players may not communicate information that reveals or suggests the contents of their hand.

Players may communicate public information.

Allowed examples include:

- "I have two cards in hand."
- "We only have 3 cards left in the Tavern deck!"

Prohibited examples include statements such as:

- Revealing a specific card in hand
- Asking for a particular suit based on hidden information
- Suggesting a play because of cards held in hand
- Asking another player not to defeat an enemy because of hidden cards

After a Jester is played, players may temporarily express whether they would prefer to go next, but they still cannot reveal their cards.

---

## Game End

The players **win** when they defeat the final King.

The players **lose** if:

- A player cannot discard enough cards to satisfy enemy damage
- A player is unable to play a card or yield on their turn

---

## Solo Play

For a one-player game, use the normal setup with the following changes.

Place the two Jesters to the side instead of including them in the Tavern deck.

The player uses a single hand with a maximum size of **8 cards**.

Play turns normally, one after another.

### Solo Jester power

A set-aside Jester may be flipped to activate this power:

> Discard your hand and refill to 8 cards.

This does **not** count as drawing for the purpose of enemy Diamond immunity.

There are two Jesters, so this power can be used at most twice per game.

Flipping a Jester in this way does not cancel enemy immunity.

The Jester power may be used:

- At the start of Step 1, before playing a card
- At the start of Step 4, before suffering damage

### Solo victory ranks

| Jesters Used | Victory |
|---:|---|
| 2 | Bronze Victory |
| 1 | Silver Victory |
| 0 | Gold Victory |
