import * as v from 'valibot';

// IDs have no prescribed format, but an empty string cannot identify anything.
export const IdentifierSchema = v.pipe(v.string(), v.minLength(1));
