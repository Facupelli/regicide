import * as v from 'valibot';

export const PLAYER_NAME_MAX_LENGTH = 32;

export const PlayerNameSchema = v.pipe(
  v.string(),
  v.transform((name) => name.trim()),
  v.minLength(1),
  v.maxLength(PLAYER_NAME_MAX_LENGTH),
  v.check((name) => !/[\p{Cc}\p{Cf}]/u.test(name)),
);
export type PlayerName = v.InferOutput<typeof PlayerNameSchema>;
