import { SIGN_IN_CODE } from "../../shared/formats.generated";

const ALPHABET = SIGN_IN_CODE.alphabet;

export const CODE_LENGTH = SIGN_IN_CODE.length;

const GROUP = SIGN_IN_CODE.group;

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function isCompleteCode(canonical: string): boolean {
  if (canonical.length !== CODE_LENGTH) return false;

  for (let i = 0; i < canonical.length; i++) {
    if (!ALPHABET.includes(canonical[i])) return false;
  }
  return true;
}

export function formatCode(canonical: string): string {
  const groups: string[] = [];
  for (let i = 0; i < canonical.length; i += GROUP) groups.push(canonical.slice(i, i + GROUP));
  return groups.join("-");
}

export function formatCodeAsTyped(raw: string): string {
  const kept = normalizeCode(raw)
    .split("")
    .filter((c) => ALPHABET.includes(c))
    .join("");
  return formatCode(kept.slice(0, CODE_LENGTH));
}
