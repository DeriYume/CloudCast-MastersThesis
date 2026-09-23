import { create } from "zustand";
import * as cc from "./sodium";
import { openMk, createRecoveryVault, privateKeyFromPassword, rewrapForNewPassword } from "./userkeys";
import { META } from "../../shared/formats.generated";
import { UserError } from "../../utils/errors";

interface Keys {
  userSk: Uint8Array;
  publicKey: Uint8Array;
  mk: Uint8Array;
  kdfSalt: Uint8Array;
  encryptedPrivateKey: Uint8Array;
}
let keys: Keys | null = null;

const SS_KEY = "cc.crypto.session";

const b64e = (u: Uint8Array): string => btoa(String.fromCharCode(...u));
const b64d = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

interface SessionState { unlocked: boolean; }
export const useCryptoSession = create<SessionState>(() => ({ unlocked: false }));

function persist(k: Keys): void {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify({
      sk: b64e(k.userSk), pk: b64e(k.publicKey), mk: b64e(k.mk),
      ks: b64e(k.kdfSalt), epk: b64e(k.encryptedPrivateKey),
    }));
  } catch {  }
}

function restore(): boolean {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return false;
    const o = JSON.parse(raw) as { sk: string; pk: string; mk: string; ks?: string; epk?: string };

    keys = {
      userSk: b64d(o.sk), publicKey: b64d(o.pk), mk: b64d(o.mk),
      kdfSalt: o.ks ? b64d(o.ks) : new Uint8Array(0),
      encryptedPrivateKey: o.epk ? b64d(o.epk) : new Uint8Array(0),
    };
    return true;
  } catch { keys = null; return false; }
}

export function setSession(
  userSk: Uint8Array,
  publicKey: Uint8Array,
  mkSealed: Uint8Array,
  kdfSalt: Uint8Array = new Uint8Array(0),
  encryptedPrivateKey: Uint8Array = new Uint8Array(0),
): void {
  keys = { userSk, publicKey, mk: openMk(mkSealed, publicKey, userSk), kdfSalt, encryptedPrivateKey };
  persist(keys);
  useCryptoSession.setState({ unlocked: true });
}

export function canVerifyPassword(): boolean {
  const k = keys;
  return !!k && k.kdfSalt.length > 0 && k.encryptedPrivateKey.length > 0;
}

export function verifyPassword(password: string): boolean {
  const k = keys;
  if (!k || k.kdfSalt.length === 0 || k.encryptedPrivateKey.length === 0) return false;
  try {
    const sk = privateKeyFromPassword(password, k.kdfSalt, k.encryptedPrivateKey);
    return sk.length === k.userSk.length && sk.every((b, i) => b === k.userSk[i]);
  } catch {
    return false;
  }
}

export function rewrapUnderNewPassword(newPassword: string): string {
  const k = K();
  const rewrapped = rewrapForNewPassword(k.userSk, newPassword, k.kdfSalt);
  keys = { ...k, encryptedPrivateKey: rewrapped };
  persist(keys);
  return cc.toB64(rewrapped);
}
export function clearSession(): void {
  keys = null;
  try { sessionStorage.removeItem(SS_KEY); } catch {  }
  useCryptoSession.setState({ unlocked: false });
}
export function isUnlocked(): boolean { return keys !== null; }

if (restore()) useCryptoSession.setState({ unlocked: true });
function K(): Keys { if (!keys) throw new UserError("Your keys are locked - please sign in again."); return keys; }

export const sealName = (name: string): string => cc.toB64(cc.secretboxSeal(cc.utf8(name), K().mk));
export function openName(nameEncB64: string | null | undefined): string {
  if (!nameEncB64) return "";
  try { return cc.fromUtf8(cc.secretboxOpen(cc.fromB64(nameEncB64), K().mk)); } catch { return "(unreadable)"; }
}

export const sealBlob = (bytes: Uint8Array): string => cc.toB64(cc.secretboxSeal(bytes, K().mk));
export const openBlob = (b64: string): Uint8Array => cc.secretboxOpen(cc.fromB64(b64), K().mk);

export const myPublicKeyB64 = (): string => cc.toB64(K().publicKey);
export const newDek = (): Uint8Array => cc.generateDek();
export const wrapDekForSelf = (dek: Uint8Array): string => cc.toB64(cc.sealTo(dek, K().publicKey));
export const wrapDekForPub = (dek: Uint8Array, recipientPkB64: string): string =>
  cc.toB64(cc.sealTo(dek, cc.fromB64(recipientPkB64)));
export const openWrappedDek = (wrappedB64: string): Uint8Array =>
  cc.sealOpen(cc.fromB64(wrappedB64), K().publicKey, K().userSk);

export const openSealedBytesToMe = (sealedB64: string): Uint8Array =>
  cc.sealOpen(cc.fromB64(sealedB64), K().publicKey, K().userSk);

export const sealSkTo = (transferPkB64: string): string =>
  cc.toB64(cc.sealTo(K().userSk, cc.fromB64(transferPkB64)));

export function newRecoveryVault(): { recoveryCode: string; recovery_encrypted_private_key: string } {
  const v = createRecoveryVault(K().userSk);
  return { recoveryCode: v.recoveryCode, recovery_encrypted_private_key: cc.toB64(v.recoveryEncryptedPrivateKey) };
}

export interface FileMeta {
  name: string;
  mime: string;
}

export const DEFAULT_MIME = META.defaultMime;

const encodeMeta = (name: string, mime: string): Uint8Array =>
  cc.utf8(JSON.stringify({ [META.nameKey]: name, [META.mimeKey]: mime || DEFAULT_MIME }));

function decodeMeta(plain: Uint8Array): FileMeta {
  const text = cc.fromUtf8(plain);
  try {
    const o = JSON.parse(text);
    const n = o?.[META.nameKey];
    const m = o?.[META.mimeKey];
    if (typeof n === "string") {
      return { name: n, mime: typeof m === "string" && m ? m : DEFAULT_MIME };
    }
  } catch {  }
  return { name: text, mime: DEFAULT_MIME };
}

const UNREADABLE_META: FileMeta = { name: "(unreadable)", mime: DEFAULT_MIME };

export const sealMeta = (name: string, mime: string): string =>
  cc.toB64(cc.secretboxSeal(encodeMeta(name, mime), K().mk));

export function openMeta(metaEncB64: string | null | undefined): FileMeta {
  if (!metaEncB64) return { name: "", mime: DEFAULT_MIME };
  try { return decodeMeta(cc.secretboxOpen(cc.fromB64(metaEncB64), K().mk)); } catch { return UNREADABLE_META; }
}

export const sealMetaForPub = (name: string, mime: string, recipientPkB64: string): string =>
  cc.toB64(cc.sealTo(encodeMeta(name, mime), cc.fromB64(recipientPkB64)));

export function openMetaSealedToMe(sealedB64: string | null | undefined): FileMeta {
  if (!sealedB64) return { name: "", mime: DEFAULT_MIME };
  try { return decodeMeta(cc.sealOpen(cc.fromB64(sealedB64), K().publicKey, K().userSk)); } catch { return UNREADABLE_META; }
}

export const sealNameForPub = (name: string, recipientPkB64: string): string =>
  cc.toB64(cc.sealTo(cc.utf8(name), cc.fromB64(recipientPkB64)));
export const openNameSealedToMe = (sealedB64: string | null | undefined): string => {
  if (!sealedB64) return "";
  try { return cc.fromUtf8(cc.sealOpen(cc.fromB64(sealedB64), K().publicKey, K().userSk)); } catch { return "(unreadable)"; }
};
