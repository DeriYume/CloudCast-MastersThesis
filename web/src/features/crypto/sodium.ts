import _sodium from "libsodium-wrappers-sumo";

let s: typeof _sodium | null = null;
export async function ready(): Promise<void> {
  if (!s) { await _sodium.ready; s = _sodium; }
}
function S(): typeof _sodium {
  if (!s) throw new Error("crypto not initialised - await ready() first");
  return s;
}

export const ARGON2ID = { OPS: 3, MEM: 67108864, SALTBYTES: 16, KEYBYTES: 32 } as const;

export const toB64 = (b: Uint8Array): string => S().to_base64(b, S().base64_variants.ORIGINAL);
export const fromB64 = (t: string): Uint8Array => S().from_base64(t, S().base64_variants.ORIGINAL);
export const toB64Url = (b: Uint8Array): string => S().to_base64(b, S().base64_variants.URLSAFE_NO_PADDING);
export const fromB64Url = (t: string): Uint8Array => S().from_base64(t, S().base64_variants.URLSAFE_NO_PADDING);
export const toHex = (b: Uint8Array): string => S().to_hex(b);
export const fromHex = (t: string): Uint8Array => S().from_hex(t);
export const utf8 = (t: string): Uint8Array => S().from_string(t);
export const fromUtf8 = (b: Uint8Array): string => S().to_string(b);

export interface Keypair { publicKey: Uint8Array; privateKey: Uint8Array; }

export const randomBytes = (n: number): Uint8Array => S().randombytes_buf(n);
export const generateDek = (): Uint8Array => randomBytes(32);
export const generateSalt = (): Uint8Array => randomBytes(ARGON2ID.SALTBYTES);

export function generateKeypair(): Keypair {
  const kp = S().crypto_box_keypair();
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}
export function keypairFromSeed(seed: Uint8Array): Keypair {
  const kp = S().crypto_box_seed_keypair(seed);
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}
export function publicFromSecret(sk: Uint8Array): Uint8Array {
  return S().crypto_scalarmult_base(sk);
}

export function deriveVaultKey(password: string, salt: Uint8Array): Uint8Array {
  return S().crypto_pwhash(
    ARGON2ID.KEYBYTES, password, salt, ARGON2ID.OPS, ARGON2ID.MEM, S().crypto_pwhash_ALG_ARGON2ID13);
}
export const SRP_STRETCH_CONTEXT = "cloudcast-srp-v1:";

// The SRP verifier is derived from the password, and a leaked database contains it.
// Stretching the password with Argon2id first makes guessing against the verifier cost
// the same as guessing against the vault, instead of a single SHA-256.
export function srpPassword(password: string, srpSaltHex: string): string {
  const salt = S().crypto_generichash(ARGON2ID.SALTBYTES, utf8(SRP_STRETCH_CONTEXT + srpSaltHex));
  const stretched = deriveVaultKey(password, salt);
  const hex = toHex(stretched);
  wipe(stretched);
  return hex;
}

export function recoveryVaultKey(recoveryKey: Uint8Array): Uint8Array {
  return S().crypto_generichash(32, recoveryKey);
}

export function secretboxSeal(message: Uint8Array, key: Uint8Array): Uint8Array {
  const nonce = S().randombytes_buf(S().crypto_secretbox_NONCEBYTES);
  const ct = S().crypto_secretbox_easy(message, nonce, key);
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce); out.set(ct, nonce.length);
  return out;
}
export function secretboxSealWithNonce(message: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
  const ct = S().crypto_secretbox_easy(message, nonce, key);
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce); out.set(ct, nonce.length);
  return out;
}

export function secretboxOpen(blob: Uint8Array, key: Uint8Array): Uint8Array {
  const n = S().crypto_secretbox_NONCEBYTES;
  return S().crypto_secretbox_open_easy(blob.slice(n), blob.slice(0, n), key);
}

export const sealTo = (message: Uint8Array, pk: Uint8Array): Uint8Array => S().crypto_box_seal(message, pk);
export const sealOpen = (blob: Uint8Array, pk: Uint8Array, sk: Uint8Array): Uint8Array => S().crypto_box_seal_open(blob, pk, sk);

export function wipe(...buffers: (Uint8Array | undefined | null)[]): void {
  for (const b of buffers) if (b) b.fill(0);
}
