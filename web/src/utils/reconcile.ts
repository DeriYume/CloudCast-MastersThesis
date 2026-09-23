function shallowEqual<T extends object>(a: T, b: T): boolean {
  const ak = Object.keys(a) as (keyof T)[];
  const bk = Object.keys(b) as (keyof T)[];
  if (ak.length !== bk.length) return false;
  for (const k of ak) {

    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function reconcile<T extends { id: string }>(prev: T[], next: T[]): T[] {
  if (prev === next) return prev;
  let changed = prev.length !== next.length;
  const byId = new Map(prev.map((p) => [p.id, p]));

  const merged = next.map((item, i) => {
    const old = byId.get(item.id);
    if (old !== undefined && shallowEqual(old, item)) {

      if (prev[i] !== old) changed = true;
      return old;
    }
    changed = true;
    return item;
  });

  return changed ? merged : prev;
}

export function reconcileItem<T extends object>(prev: T | null, next: T | null): T | null {
  if (prev === next || prev === null || next === null) return next;
  return shallowEqual(prev, next) ? prev : next;
}

export function reconcileRecord<T>(
  prev: Record<string, T>,
  next: Record<string, T>
): Record<string, T> {
  if (prev === next) return prev;
  const pk = Object.keys(prev);
  if (pk.length !== Object.keys(next).length) return next;
  for (const k of pk) if (prev[k] !== next[k]) return next;
  return prev;
}
