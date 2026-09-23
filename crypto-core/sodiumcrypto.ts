import _sodium from "libsodium-wrappers-sumo";

let sodium: typeof _sodium | null = null;
export async function ready(): Promise<void> {
  if (!sodium) { await _sodium.ready; sodium = _sodium; }
}
function S(): typeof _sodium {
  if (!sodium) throw new Error("crypto-core not initialised - await ready() first");
  return sodium;
}

export const ARGON2ID = { OPS: 3, MEM: 67108864, SALTBYTES: 16, KEYBYTES: 32 } as const;

export interface Keypair { publicKey: Buffer; privateKey: Buffer; }

export function generateKeypair(): Keypair {
  const kp = S().crypto_box_keypair();
  return { publicKey: Buffer.from(kp.publicKey), privateKey: Buffer.from(kp.privateKey) };
}
export function keypairFromSeed(seed: Buffer): Keypair {
  const kp = S().crypto_box_seed_keypair(seed);
  return { publicKey: Buffer.from(kp.publicKey), privateKey: Buffer.from(kp.privateKey) };
}
export function randomBytes(n: number): Buffer { return Buffer.from(S().randombytes_buf(n)); }
export function generateDek(): Buffer { return randomBytes(32); }
export function generateSalt(): Buffer { return randomBytes(ARGON2ID.SALTBYTES); }

export function deriveVaultKey(password: string, salt: Buffer): Buffer {
  return Buffer.from(S().crypto_pwhash(
    ARGON2ID.KEYBYTES, password, salt, ARGON2ID.OPS, ARGON2ID.MEM,
    S().crypto_pwhash_ALG_ARGON2ID13,
  ));
}
export function recoveryVaultKey(recoveryKey: Buffer): Buffer {
  return Buffer.from(S().crypto_generichash(32, recoveryKey));
}

export function secretboxSeal(message: Buffer, key: Buffer): Buffer {
  const s = S();
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  return Buffer.concat([Buffer.from(nonce), Buffer.from(s.crypto_secretbox_easy(message, nonce, key))]);
}
export function secretboxOpen(blob: Buffer, key: Buffer): Buffer {
  const s = S();
  const n = s.crypto_secretbox_NONCEBYTES;
  return Buffer.from(s.crypto_secretbox_open_easy(blob.subarray(n), blob.subarray(0, n), key));
}
export function secretboxSealWithNonce(message: Buffer, key: Buffer, nonce: Buffer): Buffer {
  return Buffer.concat([Buffer.from(nonce), Buffer.from(S().crypto_secretbox_easy(message, nonce, key))]);
}

export function sealTo(message: Buffer, recipientPk: Buffer): Buffer { return Buffer.from(S().crypto_box_seal(message, recipientPk)); }
export function sealOpen(blob: Buffer, pk: Buffer, sk: Buffer): Buffer { return Buffer.from(S().crypto_box_seal_open(blob, pk, sk)); }
