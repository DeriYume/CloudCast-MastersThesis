import { describe, it, expect, beforeAll } from "vitest";
import * as cc from "../../src/features/crypto/sodium";
import { encryptFile, encryptFileWithPrefix, decryptFile, decryptRange, plaintextLength } from "../../src/features/crypto/filecrypto";

const CHUNK = 20;
beforeAll(async () => { await cc.ready(); });

describe("round trip", () => {
  it.each([0, 1, 19, 20, 21, 40, 41, 200])("survives a %i-byte plaintext", async (n) => {
    const plain = cc.randomBytes(n);
    const dek = cc.generateDek();
    const ct = await encryptFile(plain, dek, CHUNK);
    expect(plaintextLength(ct)).toBe(n);
    expect(await decryptFile(ct, dek)).toEqual(plain);
  });

  it("uses a fresh nonce prefix for every file", async () => {
    const plain = cc.utf8("same plaintext, same key");
    const dek = cc.generateDek();
    const a = await encryptFile(plain, dek);
    const b = await encryptFile(plain, dek);
    expect(cc.toHex(a)).not.toBe(cc.toHex(b));
  });
});

describe("authentication", () => {
  it("rejects a wrong key", async () => {
    const ct = await encryptFile(cc.randomBytes(100), cc.generateDek());
    await expect(decryptFile(ct, cc.generateDek())).rejects.toThrow();
  });

  it("rejects a flipped bit in the body", async () => {
    const dek = cc.generateDek();
    const ct = await encryptFile(cc.randomBytes(100), dek, CHUNK);
    ct[30] ^= 1;
    await expect(decryptFile(ct, dek)).rejects.toThrow();
  });

  it("rejects tampering with the header, which is the AAD of every chunk", async () => {
    const dek = cc.generateDek();
    const ct = await encryptFile(cc.randomBytes(100), dek, CHUNK);
    ct[15] ^= 1;
    await expect(decryptFile(ct, dek)).rejects.toThrow();
  });

  it("rejects a truncated file", async () => {
    const dek = cc.generateDek();
    const ct = await encryptFile(cc.randomBytes(100), dek, CHUNK);
    await expect(decryptFile(ct.subarray(0, ct.length - 10), dek)).rejects.toThrow();
  });

  it("rejects a foreign container", async () => {
    await expect(decryptFile(cc.randomBytes(64), cc.generateDek())).rejects.toThrow();
  });

  it("refuses a nonce prefix of the wrong length", async () => {
    await expect(encryptFileWithPrefix(cc.utf8("x"), cc.generateDek(), cc.randomBytes(6))).rejects.toThrow();
  });
});

describe("range reads", () => {
  it("returns the same bytes as decrypting the whole file", async () => {
    const plain = cc.randomBytes(205);
    const dek = cc.generateDek();
    const ct = await encryptFile(plain, dek, CHUNK);
    for (const [s, e] of [[0, 0], [0, 19], [19, 20], [5, 45], [200, 204], [0, 204]]) {
      expect(await decryptRange(ct, dek, s, e)).toEqual(plain.subarray(s, e + 1));
    }
  });

  it("clamps out-of-bounds ranges instead of overrunning", async () => {
    const plain = cc.randomBytes(50);
    const dek = cc.generateDek();
    const ct = await encryptFile(plain, dek, CHUNK);
    expect(await decryptRange(ct, dek, 40, 999)).toEqual(plain.subarray(40));
    expect(await decryptRange(ct, dek, 60, 70)).toEqual(new Uint8Array(0));
  });

  it("still authenticates: a tampered chunk fails even when read by range", async () => {
    const dek = cc.generateDek();
    const ct = await encryptFile(cc.randomBytes(100), dek, CHUNK);
    ct[HEADER_AND_FIRST_CHUNK] ^= 1;
    await expect(decryptRange(ct, dek, 0, 19)).rejects.toThrow();
  });
});

const HEADER_AND_FIRST_CHUNK = 25;
