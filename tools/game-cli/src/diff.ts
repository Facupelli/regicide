export type Change = { path: string; before: unknown; after: unknown };
const absent = { present: false };

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function diff(before: unknown, after: unknown): Change[] {
  const changes: Change[] = [];
  function visit(left: unknown, right: unknown, path: string): void {
    if (Object.is(left, right)) return;
    if (Array.isArray(left) && Array.isArray(right)) {
      for (let i = 0; i < Math.max(left.length, right.length); i++) {
        if (i >= left.length)
          changes.push({ path: `${path}[${i}]`, before: absent, after: right[i] });
        else if (i >= right.length)
          changes.push({ path: `${path}[${i}]`, before: left[i], after: absent });
        else visit(left[i], right[i], `${path}[${i}]`);
      }
      return;
    }
    if (object(left) && object(right)) {
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        const child = path ? `${path}.${key}` : key;
        if (!Object.hasOwn(left, key))
          changes.push({ path: child, before: absent, after: right[key] });
        else if (!Object.hasOwn(right, key))
          changes.push({ path: child, before: left[key], after: absent });
        else visit(left[key], right[key], child);
      }
      return;
    }
    changes.push({ path, before: left, after: right });
  }
  visit(before, after, '');
  return changes;
}
