import * as v from 'valibot';

export const TurnDecisionSchema = v.strictObject({
  command: v.union([
    v.strictObject({ kind: v.picklist(['play-cards']), cardIds: v.array(v.string()) }),
    v.strictObject({ kind: v.picklist(['yield']) }),
    v.strictObject({ kind: v.picklist(['use-solo-jester']) }),
  ]),
});

export const RetaliationDecisionSchema = v.strictObject({
  command: v.union([
    v.strictObject({ kind: v.picklist(['discard-for-damage']), cardIds: v.array(v.string()) }),
    v.strictObject({ kind: v.picklist(['use-solo-jester']) }),
    v.strictObject({ kind: v.picklist(['accept-defeat']) }),
  ]),
});

export const NextPlayerDecisionSchema = v.strictObject({
  command: v.strictObject({
    kind: v.picklist(['choose-next-player']),
    targetPlayerId: v.string(),
  }),
});
