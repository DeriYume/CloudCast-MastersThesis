import { describe, it, expect, beforeAll } from "vitest";
import * as cc from "../../src/features/crypto/sodium";
import {
  createUserKeys, createRecoveryVault, openMk, privateKeyFromPassword,
  privateKeyFromRecovery, rewrapForNewPassword, wrapDekFor, unwrapDek,
} from "../../src/features/crypto/userkeys";

const PW = "example-vector-password";
beforeAll(async () => { await cc.ready(); });

describe("two independent ways in", () => {
  it("password and recovery code unlock the same private key", () => {
    const u = createUserKeys(PW);
    expect(privateKeyFromPassword(PW, u.salt, u.encryptedPrivateKey))
      .toEqual(privateKeyFromRecovery(u.recoveryCode, u.recoveryEncryptedPrivateKey));
  });

  it("rejects a wrong password (Poly1305 fails; the server casts no vote)", () => {
    const u = createUserKeys(PW);
    expect(() => privateKeyFromPassword("nope", u.salt, u.encryptedPrivateKey)).toThrow();
  });

  it("rejects a wrong recovery code", () => {
    const u = createUserKeys(PW);
    const other = cc.toB64Url(cc.randomBytes(32));
    expect(() => privateKeyFromRecovery(other, u.recoveryEncryptedPrivateKey)).toThrow();
  });

  it("issues a recovery code that survives the base64url round trip", () => {
    for (let i = 0; i < 20; i++) {
      const u = createUserKeys(PW);
      expect(u.recoveryCode).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(cc.fromB64Url(u.recoveryCode).length).toBe(32);
    }
  });

  it("regenerating the recovery vault keeps the same private key", () => {
    const u = createUserKeys(PW);
    const sk = privateKeyFromPassword(PW, u.salt, u.encryptedPrivateKey);
    const fresh = createRecoveryVault(sk);
    expect(privateKeyFromRecovery(fresh.recoveryCode, fresh.recoveryEncryptedPrivateKey)).toEqual(sk);
    expect(fresh.recoveryCode).not.toBe(u.recoveryCode);
  });
});

describe("changing the password", () => {
  it("re-seals the same key, so no file has to be re-encrypted", () => {
    const u = createUserKeys("old-pass");
    const sk = privateKeyFromPassword("old-pass", u.salt, u.encryptedPrivateKey);
    const rewrapped = rewrapForNewPassword(sk, "brand-new-pass", u.salt);
    expect(privateKeyFromPassword("brand-new-pass", u.salt, rewrapped)).toEqual(sk);
  });

  it("invalidates the old password", () => {
    const u = createUserKeys("old-pass");
    const sk = privateKeyFromPassword("old-pass", u.salt, u.encryptedPrivateKey);
    const rewrapped = rewrapForNewPassword(sk, "brand-new-pass", u.salt);
    expect(() => privateKeyFromPassword("old-pass", u.salt, rewrapped)).toThrow();
  });
});

describe("metadata key", () => {
  it("opens only with the owner's keypair", () => {
    const u = createUserKeys(PW);
    const sk = privateKeyFromPassword(PW, u.salt, u.encryptedPrivateKey);
    expect(openMk(u.mkSealed, u.publicKey, sk).length).toBe(32);

    const stranger = createUserKeys("other");
    const strangerSk = privateKeyFromPassword("other", stranger.salt, stranger.encryptedPrivateKey);
    expect(() => openMk(u.mkSealed, stranger.publicKey, strangerSk)).toThrow();
  });
});

describe("sharing a file key", () => {
  it("wraps for a recipient who was never online, and excludes everyone else", () => {
    const owner = createUserKeys("owner-pass");
    const ownerSk = privateKeyFromPassword("owner-pass", owner.salt, owner.encryptedPrivateKey);
    const recip = createUserKeys("recip-pass");
    const recipSk = privateKeyFromPassword("recip-pass", recip.salt, recip.encryptedPrivateKey);
    const dek = cc.generateDek();

    const forRecip = wrapDekFor(dek, recip.publicKey);
    expect(unwrapDek(forRecip, recip.publicKey, recipSk)).toEqual(dek);
    expect(unwrapDek(wrapDekFor(dek, owner.publicKey), owner.publicKey, ownerSk)).toEqual(dek);
    expect(() => unwrapDek(forRecip, owner.publicKey, ownerSk)).toThrow();
  });

  it("produces a different envelope every time (anonymous sealed box)", () => {
    const kp = cc.generateKeypair();
    const dek = cc.generateDek();
    expect(cc.toHex(wrapDekFor(dek, kp.publicKey))).not.toBe(cc.toHex(wrapDekFor(dek, kp.publicKey)));
  });

  it("is 80 bytes for a 32-byte key", () => {
    expect(wrapDekFor(cc.generateDek(), cc.generateKeypair().publicKey).length).toBe(80);
  });
});

describe("key material hygiene", () => {
  it("does not leave the vault key or MK in the returned object", () => {
    const u = createUserKeys(PW) as unknown as Record<string, unknown>;
    for (const k of ["vaultKey", "mk", "privateKey", "recoveryKeyBytes"]) {
      expect(u[k]).toBeUndefined();
    }
  });
});
