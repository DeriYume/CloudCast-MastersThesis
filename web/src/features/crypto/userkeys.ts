import * as cc from "./sodium";

export interface NewUserKeys {
  salt: Uint8Array;
  publicKey: Uint8Array;
  encryptedPrivateKey: Uint8Array;
  recoveryEncryptedPrivateKey: Uint8Array;
  mkSealed: Uint8Array;
  recoveryCode: string;
}

export function createUserKeys(password: string): NewUserKeys {
  const salt = cc.generateSalt();
  const kp = cc.generateKeypair();
  const recoveryKeyBytes = cc.randomBytes(32);
  const recoveryCode = cc.toB64Url(recoveryKeyBytes);
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
  cc.wipe(kp.privateKey, vaultKey, rVaultKey, recoveryKeyBytes, mk);
  return out;
}

export function createRecoveryVault(privateKey: Uint8Array): { recoveryCode: string; recoveryEncryptedPrivateKey: Uint8Array } {
  const recoveryKeyBytes = cc.randomBytes(32);
  const out = {
    recoveryCode: cc.toB64Url(recoveryKeyBytes),
    recoveryEncryptedPrivateKey: cc.secretboxSeal(privateKey, cc.recoveryVaultKey(recoveryKeyBytes)),
  };
  cc.wipe(recoveryKeyBytes);
  return out;
}

export const openMk = (mkSealed: Uint8Array, pk: Uint8Array, sk: Uint8Array): Uint8Array => cc.sealOpen(mkSealed, pk, sk);

export const privateKeyFromPassword = (password: string, salt: Uint8Array, enc: Uint8Array): Uint8Array =>
  cc.secretboxOpen(enc, cc.deriveVaultKey(password, salt));

export const privateKeyFromRecovery = (recoveryCode: string, enc: Uint8Array): Uint8Array =>
  cc.secretboxOpen(enc, cc.recoveryVaultKey(cc.fromB64Url(recoveryCode)));

export const rewrapForNewPassword = (privateKey: Uint8Array, newPassword: string, salt: Uint8Array): Uint8Array =>
  cc.secretboxSeal(privateKey, cc.deriveVaultKey(newPassword, salt));

export const wrapDekFor = (dek: Uint8Array, recipientPk: Uint8Array): Uint8Array => cc.sealTo(dek, recipientPk);
export const unwrapDek = (wrapped: Uint8Array, pk: Uint8Array, sk: Uint8Array): Uint8Array => cc.sealOpen(wrapped, pk, sk);
