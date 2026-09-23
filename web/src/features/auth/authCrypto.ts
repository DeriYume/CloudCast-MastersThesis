import * as srpClient from "secure-remote-password/client";
import * as cc from "../crypto/sodium";
import { createUserKeys, privateKeyFromPassword, privateKeyFromRecovery, rewrapForNewPassword } from "../crypto/userkeys";
import { setSession } from "../crypto/session";
import { registerAccount, srpChallenge, srpAuthenticate, recoverChallenge, recoverSubmit } from "../../api/api";
import { UserError } from "../../utils/errors";

export async function registerHybrid(email: string, password: string): Promise<{ recoveryCode: string }> {
  await cc.ready();
  const keys = createUserKeys(password);
  const srp_salt = srpClient.generateSalt();
  const srp_verifier = srpClient.deriveVerifier(srpClient.derivePrivateKey(srp_salt, email, cc.srpPassword(password, srp_salt)));
  await registerAccount({
    email,
    srp_salt,
    srp_verifier,
    public_key: cc.toB64(keys.publicKey),
    encrypted_private_key: cc.toB64(keys.encryptedPrivateKey),
    recovery_encrypted_private_key: cc.toB64(keys.recoveryEncryptedPrivateKey),
    kdf_salt: cc.toB64(keys.salt),
    mk_sealed: cc.toB64(keys.mkSealed),
  });
  return { recoveryCode: keys.recoveryCode };
}

export async function loginHybrid(email: string, password: string): Promise<{ token: string; rotationRequired: boolean; pendingDeletion: string | null }> {
  await cc.ready();
  const ch = await srpChallenge(email);
  const clientEph = srpClient.generateEphemeral();
  const clientSession = srpClient.deriveSession(
    clientEph.secret, ch.serverPublic, ch.salt, email,
    srpClient.derivePrivateKey(ch.salt, email, cc.srpPassword(password, ch.salt))
  );
  const auth = await srpAuthenticate(ch.challengeId, clientEph.public, clientSession.proof);
  srpClient.verifySession(clientEph.public, clientSession, auth.serverProof);

  const userSk = privateKeyFromPassword(password, cc.fromB64(auth.vault.kdf_salt), cc.fromB64(auth.vault.encrypted_private_key));
  setSession(
    userSk,
    cc.fromB64(auth.vault.public_key),
    cc.fromB64(auth.vault.mk_sealed),
    cc.fromB64(auth.vault.kdf_salt),
    cc.fromB64(auth.vault.encrypted_private_key),
  );
  return { token: auth.token, rotationRequired: auth.rotationRequired, pendingDeletion: auth.pendingDeletion };
}

export async function recoverHybrid(email: string, recoveryCode: string, newPassword: string): Promise<void> {
  await cc.ready();
  const ch = await recoverChallenge(email);

  let sk: Uint8Array;
  try {
    sk = privateKeyFromRecovery(recoveryCode.trim(), cc.fromB64(ch.recovery_encrypted_private_key));
  } catch {
    throw new UserError("That recovery code didn't work - check for typos or extra spaces.");
  }

  const pk = cc.publicFromSecret(sk);
  const nonce = cc.sealOpen(cc.fromB64(ch.sealed_nonce), pk, sk);

  const encrypted_private_key = cc.toB64(rewrapForNewPassword(sk, newPassword, cc.fromB64(ch.kdf_salt)));
  const srp_salt = srpClient.generateSalt();
  const srp_verifier = srpClient.deriveVerifier(srpClient.derivePrivateKey(srp_salt, email, cc.srpPassword(newPassword, srp_salt)));

  await recoverSubmit({ challengeId: ch.challengeId, nonce: cc.toB64(nonce), srp_salt, srp_verifier, encrypted_private_key });
}
