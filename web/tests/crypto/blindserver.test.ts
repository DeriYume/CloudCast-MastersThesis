import { describe, it, expect, beforeAll } from "vitest";
import * as cc from "../../src/features/crypto/sodium";
import { encryptFile } from "../../src/features/crypto/filecrypto";
import { createUserKeys, privateKeyFromPassword, wrapDekFor } from "../../src/features/crypto/userkeys";

const SECRET = "PROTECTED-MARKER-3f9a1c";
const PW = "example-vector-password";

function occurrences(haystack: Uint8Array, needle: string): string[] {
  const hay = Array.from(haystack, (b) => String.fromCharCode(b)).join("");
  const hex = cc.toHex(haystack);
  const utf8 = cc.utf8(needle);
  const found: string[] = [];
  if (hay.includes(Array.from(utf8, (b) => String.fromCharCode(b)).join(""))) found.push("utf-8 bytes");
  if (hay.includes(needle)) found.push("literal");
  if (hex.includes(cc.toHex(utf8))) found.push("hex");
  if (cc.toB64(haystack).includes(cc.toB64(utf8).replace(/=+$/, ""))) found.push("base64");
  return found;
}

beforeAll(async () => { await cc.ready(); });

describe("what the server receives is opaque", () => {
  it("file content does not survive in the uploaded ciphertext", async () => {
    const plain = cc.utf8(`document body containing ${SECRET} in the middle`);
    const uploaded = await encryptFile(plain, cc.generateDek());
    expect(occurrences(uploaded, SECRET)).toEqual([]);
  });

  it("holds for a small file, where there is nowhere to hide", async () => {
    const uploaded = await encryptFile(cc.utf8(SECRET), cc.generateDek());
    expect(occurrences(uploaded, SECRET)).toEqual([]);
    expect(uploaded.length).toBe(23 + cc.utf8(SECRET).length + 16);
  });

  it("a file name sealed under the metadata key does not survive", () => {
    const mk = cc.randomBytes(32);
    const sealed = cc.secretboxSeal(cc.utf8(`${SECRET}.pdf`), mk);
    expect(occurrences(sealed, SECRET)).toEqual([]);
  });

  it("the wrapped file key does not expose the key it wraps", () => {
    const kp = cc.generateKeypair();
    const dek = cc.generateDek();
    const wrapped = wrapDekFor(dek, kp.publicKey);
    expect(cc.toHex(wrapped)).not.toContain(cc.toHex(dek));
  });

  it("the stored vault does not expose the password or the private key", () => {
    const u = createUserKeys(PW);
    const sk = privateKeyFromPassword(PW, u.salt, u.encryptedPrivateKey);
    expect(occurrences(u.encryptedPrivateKey, PW)).toEqual([]);
    expect(cc.toHex(u.encryptedPrivateKey)).not.toContain(cc.toHex(sk));
    expect(cc.toHex(u.recoveryEncryptedPrivateKey)).not.toContain(cc.toHex(sk));
    expect(cc.toHex(u.encryptedPrivateKey)).not.toBe(cc.toHex(u.recoveryEncryptedPrivateKey));
  });

  it("the same plaintext uploaded twice is not recognisably the same", async () => {
    const plain = cc.utf8("identical content, uploaded twice");
    const dek = cc.generateDek();
    const a = await encryptFile(plain, dek);
    const b = await encryptFile(plain, dek);
    expect(cc.toHex(a)).not.toBe(cc.toHex(b));
    expect(a.length).toBe(b.length);
  });

  it("two users sealing the same name produce unrelated bytes", () => {
    const a = cc.secretboxSeal(cc.utf8("taxes.pdf"), cc.randomBytes(32));
    const b = cc.secretboxSeal(cc.utf8("taxes.pdf"), cc.randomBytes(32));
    expect(cc.toHex(a)).not.toBe(cc.toHex(b));
  });
});

describe("what the server can still infer", () => {
  it("learns the plaintext length from the container header", async () => {
    const plain = cc.randomBytes(5000);
    const ct = await encryptFile(plain, cc.generateDek());
    const header = ct.subarray(0, 23);
    const len = Number(new DataView(header.buffer, header.byteOffset, 23).getBigUint64(15, false));
    expect(len).toBe(5000);
  });

  it("learns the chunk size, which is fixed and reveals nothing about content", async () => {
    const ct = await encryptFile(cc.randomBytes(10), cc.generateDek());
    const header = ct.subarray(0, 23);
    expect(new DataView(header.buffer, header.byteOffset, 23).getUint32(11, false)).toBe(256 * 1024);
  });
});
