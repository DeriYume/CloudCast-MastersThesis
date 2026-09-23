import { dedupeName, idOf, type NameIndex } from "../utils/naming";
import type { ApiError, ConflictInfo } from "./http";

export type OnConflict = "replace" | "rename";

export interface ConflictChoice {
  action: "replace" | "rename" | "skip";
  all: boolean;
}

export type AskConflict = (info: ConflictInfo) => Promise<ConflictChoice>;

export function isNameConflict(e: unknown): e is ApiError {
  return e instanceof Error && (e as ApiError).code === "NAME_CONFLICT" && !!(e as ApiError).conflict;
}

export async function runWithConflict(
  op: (oc?: OnConflict) => Promise<unknown>,
  ask: AskConflict,
  memory?: { current: ConflictChoice | null }
): Promise<"applied" | "skipped"> {
  try {
    await op(undefined);
    return "applied";
  } catch (e) {
    if (!isNameConflict(e)) throw e;
    let choice = memory?.current ?? null;
    if (!choice) choice = await ask(e.conflict!);
    if (choice.all && memory) memory.current = choice;
    if (choice.action === "skip") return "skipped";
    await op(choice.action);
    return "applied";
  }
}

export async function resolveName(
  index: NameIndex,
  desired: string,
  onConflict: OnConflict | undefined,
  isFolder: boolean,
  excludeId?: string,
  deleteExisting?: (id: string) => Promise<unknown>
): Promise<string> {
  const existingId = idOf(index, desired);
  if (!existingId || existingId === excludeId) return desired;
  if (onConflict === "replace") {
    if (deleteExisting) await deleteExisting(existingId);
    return desired;
  }
  if (onConflict === "rename") return dedupeName(index, desired);
  const err = new Error(`"${desired}" already exists here`) as ApiError;
  err.code = "NAME_CONFLICT";
  err.conflict = { type: isFolder ? "folder" : "file", name: desired, existing_id: existingId };
  throw err;
}
