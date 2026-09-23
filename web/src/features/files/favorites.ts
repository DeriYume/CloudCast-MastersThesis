import { getPrefsBlob, putPrefsBlob, setFavoriteIdsCache, type ApiError } from "../../api/api";
import * as session from "../crypto/session";
import { BLOB_KIND } from "../../shared/formats.generated";
import { UserError } from "../../utils/errors";

const KIND = BLOB_KIND.favorites;

export interface FavoritesSnapshot {
  ids: Set<string>;
  revision: number;
}

const EMPTY: FavoritesSnapshot = { ids: new Set(), revision: 0 };

export async function loadFavorites(token: string): Promise<FavoritesSnapshot> {
  const { blob, revision } = await getPrefsBlob(token, KIND);
  const snapshot = decode(blob, revision);

  setFavoriteIdsCache(snapshot.ids);
  return snapshot;
}

function decode(blob: string | null, revision: number): FavoritesSnapshot {
  if (!blob) return { ids: new Set(), revision };
  try {
    const json = new TextDecoder().decode(session.openBlob(blob));
    const parsed = JSON.parse(json);
    return { ids: new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []), revision };
  } catch {

    return { ids: new Set(), revision };
  }
}

function seal(ids: Set<string>): string {
  return session.sealBlob(new TextEncoder().encode(JSON.stringify([...ids])));
}

export async function toggleFavorite(
  token: string,
  fileId: string,
  favorite: boolean,
  known?: FavoritesSnapshot,
): Promise<FavoritesSnapshot> {
  let snapshot = known ?? (await loadFavorites(token));

  for (let attempt = 0; attempt < 3; attempt++) {
    const ids = new Set(snapshot.ids);
    if (favorite) ids.add(fileId);
    else ids.delete(fileId);

    try {
      const { revision } = await putPrefsBlob(token, KIND, seal(ids), snapshot.revision);
      setFavoriteIdsCache(ids);
      return { ids, revision };
    } catch (e) {
      if ((e as ApiError).status !== 409) throw e;
      snapshot = await loadFavorites(token);
    }
  }

  throw new UserError("Couldn't update favourites - please try again.");
}

export function pruneFavorites(snapshot: FavoritesSnapshot, liveIds: Set<string>): Set<string> {
  const kept = new Set<string>();
  for (const id of snapshot.ids) if (liveIds.has(id)) kept.add(id);
  return kept;
}

export { EMPTY as EMPTY_FAVORITES };
