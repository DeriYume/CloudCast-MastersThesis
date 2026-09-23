import * as session from "../features/crypto/session";

let favoriteIds: ReadonlySet<string> = new Set();

export function setFavoriteIdsCache(ids: ReadonlySet<string>): void {
  favoriteIds = ids;
}

export function getFavoriteIdsCache(): ReadonlySet<string> {
  return favoriteIds;
}

export function hydrateFile<T extends { id?: string; meta_enc?: string | null; meta_sealed?: string | null }>(
  f: T
): T & { original_name: string; mime_type: string; is_favorite: boolean } {
  const meta = f.meta_sealed
    ? session.openMetaSealedToMe(f.meta_sealed)
    : session.openMeta(f.meta_enc ?? null);
  return {
    ...f,
    original_name: meta.name,
    mime_type: meta.mime,
    is_favorite: f.id ? favoriteIds.has(f.id) : false,
  };
}

export function hydrateFolder<T extends { name_enc?: string | null; name_sealed?: string | null }>(
  f: T
): T & { name: string } {
  const name = f.name_sealed
    ? session.openNameSealedToMe(f.name_sealed)
    : session.openName(f.name_enc ?? null);
  return { ...f, name };
}
