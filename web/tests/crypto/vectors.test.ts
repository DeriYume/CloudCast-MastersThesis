import { readFileSync } from "fs";
import { describe, it, expect, beforeAll } from "vitest";
import * as cc from "../../src/features/crypto/sodium";
import { decryptFile, encryptFileWithPrefix, decryptRange, plaintextLength } from "../../src/features/crypto/filecrypto";

const VECTORS_PATH = new URL("../../../crypto-core/test-vectors.json", import.meta.url);

interface Vectors {
  params: { argon2id: { OPS: number; MEM: number; SALTBYTES: number; KEYBYTES: number };
            sealedBoxBytes: number; secretboxNonceBytes: number };
  inputs: Record<string, string | number>;
  expected: Record<string, string>;
}

let v: Vectors;
const S = (k: string) => String(v.inputs[k]);
const E = (k: string) => v.expected[k];

beforeAll(async () => {
  try {
    v = JSON.parse(readFileSync(VECTORS_PATH, "utf8")) as Vectors;
  } catch {
    throw new Error(
      `crypto-core/test-vectors.json not found at ${VECTORS_PATH}. ` +
      `It is the shared interop gate - regenerate it with \`npm test\` in crypto-core/.`,
    );
  }
  await cc.ready();
});

describe("shared parameters", () => {
  it("Argon2id parameters match the contract", () => {
    expect(cc.ARGON2ID.OPS).toBe(v.params.argon2id.OPS);
    expect(cc.ARGON2ID.MEM).toBe(v.params.argon2id.MEM);
    expect(cc.ARGON2ID.SALTBYTES).toBe(v.params.argon2id.SALTBYTES);
    expect(cc.ARGON2ID.KEYBYTES).toBe(v.params.argon2id.KEYBYTES);
  });

  it("sealed box and secretbox overheads match", () => {
    expect(cc.sealTo(new Uint8Array(32), cc.generateKeypair().publicKey).length)
      .toBe(v.params.sealedBoxBytes);
    const MAC = 16;
    const msg = new Uint8Array(1);
    expect(cc.secretboxSeal(msg, cc.randomBytes(32)).length - msg.length - MAC)
      .toBe(v.params.secretboxNonceBytes);
  });
});

describe("key derivation vectors", () => {
  it("Argon2id vault key", () => {
    const key = cc.deriveVaultKey(S("password"), cc.fromHex(S("salt_hex")));
    expect(cc.toHex(key)).toBe(E("argon2id_vaultKey"));
  });

  it("X25519 keypair from seed", () => {
    const kp = cc.keypairFromSeed(cc.fromHex(S("keypair_seed_hex")));
    expect(cc.toHex(kp.publicKey)).toBe(E("userPK"));
    expect(cc.toHex(kp.privateKey)).toBe(E("userSK"));
  });

  it("BLAKE2b recovery key", () => {
    expect(cc.toHex(cc.recoveryVaultKey(cc.fromHex(S("recovery_key_hex"))))).toBe(E("recoveryKdfKey"));
  });

  it("secretbox with a fixed nonce", () => {
    const vaultKey = cc.fromHex(E("argon2id_vaultKey"));
    const message = cc.fromHex(E("userSK"));
    const ct = cc.secretboxSealWithNonce(message, vaultKey, cc.fromHex(S("secretbox_nonce_hex")));
    expect(cc.toHex(ct)).toBe(E("secretbox_ct"));
    expect(cc.toHex(cc.secretboxOpen(ct, vaultKey))).toBe(E("userSK"));
  });
});

describe("CCE3 container vector", () => {
  const dek = () => cc.fromHex(S("dek_hex"));
  const plain = () => cc.utf8(S("cce3_plaintext_utf8"));
  const chunk = () => Number(v.inputs.cce3_chunk_size);

  it("produces the reference ciphertext byte for byte", async () => {
    const ct = await encryptFileWithPrefix(plain(), dek(), cc.fromHex(S("cce3_nonce_prefix_hex")), chunk());
    expect(cc.toHex(ct)).toBe(E("cce3_ciphertext"));
  });

  it("decrypts the reference ciphertext produced elsewhere", async () => {
    const reference = cc.fromHex(E("cce3_ciphertext"));
    expect(cc.fromUtf8(await decryptFile(reference, dek()))).toBe(S("cce3_plaintext_utf8"));
    expect(plaintextLength(reference)).toBe(plain().length);
  });

  it("range reads match the corresponding slice", async () => {
    const reference = cc.fromHex(E("cce3_ciphertext"));
    const p = plain();
    expect(await decryptRange(reference, dek(), 10, 29)).toEqual(p.subarray(10, 30));
    expect(await decryptRange(reference, dek(), 0, p.length - 1)).toEqual(p);
  });
});
