export type NameIndex = Map<string, string>;

export function indexFromNames(items: { id: string; name: string }[]): NameIndex {
  const m: NameIndex = new Map();
  for (const it of items) m.set(it.name.toLowerCase(), it.id);
  return m;
}

export function nameExists(index: NameIndex, name: string): boolean {
  return index.has(name.toLowerCase());
}

export function idOf(index: NameIndex, name: string): string | undefined {
  return index.get(name.toLowerCase());
}

export function dedupeName(index: NameIndex, name: string): string {
  if (!nameExists(index, name)) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let n = 1; n < 10000; n++) {
    const candidate = `${base} (${n})${ext}`;
    if (!nameExists(index, candidate)) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
}
