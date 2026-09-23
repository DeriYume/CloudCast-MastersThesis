import * as cc from "./sodiumcrypto";

export interface NewUserKeys {
  salt: Buffer;
  publicKey: Buffer;
  encryptedPrivateKey: Buffer;
  recoveryEncryptedPrivateKey: Buffer;
  mkSealed: Buffer;
  recoveryCode: string;
}

export function createUserKeys(password: string): NewUserKeys {
  const salt = cc.generateSalt();
  const kp = cc.generateKeypair();
  const recoveryKeyBytes = cc.randomBytes(32);
  const recoveryCode = recoveryKeyBytes.toString("base64url");
  const mk = cc.randomBytes(32);
  const vaultKey = cc.deriveVaultKey(password, salt);
  const rVaultKey = cc.recoveryVaultKey(recoveryKeyBytes);
  const out: NewUserKeys = {
    salt,
    publicKey: kp.publicKey,
    encryptedPrivateKey: cc.secretboxSeal(kp.privateKey, vaultKey),
    recoveryEncryptedPrivateKey: cc.secretboxSeal(kp.privateKey, rVaultKey),
    mkSealed: cc.sealTo(mk, kp.publicKey),
    recoveryCode,
  };
  kp.privateKey.fill(0); vaultKey.fill(0); rVaultKey.fill(0); recoveryKeyBytes.fill(0); mk.fill(0);
  return out;
}

export function openMk(mkSealed: Buffer, publicKey: Buffer, privateKey: Buffer): Buffer {
  return cc.sealOpen(mkSealed, publicKey, privateKey);
}

export function privateKeyFromPassword(password: string, salt: Buffer, encryptedPrivateKey: Buffer): Buffer {
  return cc.secretboxOpen(encryptedPrivateKey, cc.deriveVaultKey(password, salt));
}

export function privateKeyFromRecovery(recoveryCode: string, recoveryEncryptedPrivateKey: Buffer): Buffer {
  return cc.secretboxOpen(recoveryEncryptedPrivateKey, cc.recoveryVaultKey(Buffer.from(recoveryCode, "base64url")));
}

export function rewrapForNewPassword(privateKey: Buffer, newPassword: string, salt: Buffer): Buffer {
  return cc.secretboxSeal(privateKey, cc.deriveVaultKey(newPassword, salt));
}

export function wrapDekFor(dek: Buffer, recipientPk: Buffer): Buffer { return cc.sealTo(dek, recipientPk); }
export function unwrapDek(wrapped: Buffer, pk: Buffer, sk: Buffer): Buffer { return cc.sealOpen(wrapped, pk, sk); }
