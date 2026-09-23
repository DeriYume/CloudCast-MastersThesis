import * as srpClient from "secure-remote-password/client";
import * as session from "../features/crypto/session";
import { displayNameFromEmail } from "../utils/util";
import { UserError } from "../utils/errors";
import { req } from "./http";
import { srpPassword } from "../features/crypto/sodium";
import type { UserProfile } from "./types";

const QR_SIGNIN_NOTE =
  "This device was signed in with a QR code, so we can't verify your password here. Sign in with your email and password to do this.";

export async function registerAccount(payload: Record<string, string>): Promise<{ id: string }> {
  return req("POST", "/auth/register", null, payload);
}

export interface SrpChallenge { challengeId: string; salt: string; serverPublic: string; }
export async function srpChallenge(email: string): Promise<SrpChallenge> {
  return req("POST", "/auth/srp/challenge", null, { email });
}

export interface SrpAuthResult {
  token: string;
  serverProof: string;
  rotationRequired: boolean;

  pendingDeletion: string | null;
  vault: { public_key: string; encrypted_private_key: string; kdf_salt: string; mk_sealed: string };
}
export async function srpAuthenticate(
  challengeId: string,
  clientPublic: string,
  clientProof: string
): Promise<SrpAuthResult> {
  return req("POST", "/auth/srp/authenticate", null, { challengeId, clientPublic, clientProof });
}

export interface RecoverChallenge {
  challengeId: string;
  recovery_encrypted_private_key: string;
  kdf_salt: string;
  sealed_nonce: string;
}
export async function recoverChallenge(email: string): Promise<RecoverChallenge> {
  return req("POST", "/auth/recover/challenge", null, { email });
}
export async function recoverSubmit(payload: {
  challengeId: string; nonce: string; srp_salt: string; srp_verifier: string; encrypted_private_key: string;
}): Promise<{ recovered: boolean }> {
  return req("POST", "/auth/recover", null, payload);
}

export async function logout(token: string): Promise<{ loggedOut: boolean }> {
  return req("POST", "/auth/logout", token);
}

export async function getMe(token: string): Promise<{ user: UserProfile }> {
  const r = await req<{ user: UserProfile }>("GET", "/auth/me", token);
  return { user: { ...r.user, display_name: displayNameFromEmail(r.user.email) } };
}

export const ACCOUNT_GRACE_DAYS_FALLBACK = 30;

export async function deleteAccount(
  token: string
): Promise<{ scheduled: boolean; purge_after: string; grace_days: number; notified: boolean }> {
  return req("DELETE", "/auth/account", token);
}

export async function restoreAccount(token: string): Promise<{ restored: boolean }> {
  return req("POST", "/auth/account/restore", token);
}

export interface QrStartResult {
  code: string;
  expiresAt: string;
}

export type QrPollStatus = "pending" | "approved" | "consumed" | "expired" | "invalid";

export interface QrPollResult {
  status: QrPollStatus;

  sealed_token?: string;
  sealed_sk?: string;
  public_key?: string;
  mk_sealed?: string;
}

export async function qrOffer(token: string): Promise<QrStartResult> {
  return req("POST", "/auth/qr/offer", token);
}

export async function qrRegister(code: string, transferPk: string): Promise<{ ok: boolean }> {
  return req("POST", "/auth/qr/register", null, { code, transfer_pk: transferPk });
}

export type QrPendingStatus = "waiting" | "registered" | "done" | "expired" | "invalid";
export interface QrPendingResult {
  status: QrPendingStatus;
  transfer_pk?: string;
}

export async function qrPending(token: string, code: string): Promise<QrPendingResult> {
  return req("GET", `/auth/qr/pending?code=${encodeURIComponent(code)}`, token);
}

export async function qrPoll(code: string): Promise<QrPollResult> {
  return req("GET", `/auth/qr/poll?code=${encodeURIComponent(code)}`, null);
}

export async function qrApprove(token: string, code: string, sealedSk: string): Promise<{ approved: boolean }> {
  return req("POST", "/auth/qr/approve", token, { code, sealed_sk: sealedSk });
}

export async function getPrefsBlob(
  token: string,
  kind: string
): Promise<{ blob: string | null; revision: number }> {
  return req("GET", `/files/prefs/${kind}`, token);
}

export async function putPrefsBlob(
  token: string,
  kind: string,
  blob: string,
  revision: number
): Promise<{ revision: number }> {
  return req("PUT", `/files/prefs/${kind}`, token, { blob, revision });
}

export async function changePassword(
  token: string,
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<{ changed: boolean }> {
  if (!session.canVerifyPassword()) throw new UserError(QR_SIGNIN_NOTE);
  if (!session.verifyPassword(currentPassword)) throw new UserError("That password isn't right.");
  const identity = email.trim().toLowerCase();
  const srp_salt = srpClient.generateSalt();
  const srp_verifier = srpClient.deriveVerifier(
    srpClient.derivePrivateKey(srp_salt, identity, srpPassword(newPassword, srp_salt))
  );
  return req("POST", "/auth/change-password", token, {
    srp_salt,
    srp_verifier,
    encrypted_private_key: session.rewrapUnderNewPassword(newPassword),
  });
}

export async function regenerateRecovery(
  token: string,
  recoveryEncryptedPrivateKey: string
): Promise<{ regenerated: boolean }> {
  return req("POST", "/auth/recovery/regenerate", token, {
    recovery_encrypted_private_key: recoveryEncryptedPrivateKey,
  });
}

export async function changeEmail(
  token: string,
  password: string,
  newEmail: string
): Promise<{ email: string }> {
  if (!session.canVerifyPassword()) throw new UserError(QR_SIGNIN_NOTE);
  if (!session.verifyPassword(password)) throw new UserError("That password isn't right.");
  const identity = newEmail.trim().toLowerCase();
  const srp_salt = srpClient.generateSalt();
  const srp_verifier = srpClient.deriveVerifier(
    srpClient.derivePrivateKey(srp_salt, identity, srpPassword(password, srp_salt))
  );
  return req("POST", "/auth/change-email", token, { newEmail: identity, srp_salt, srp_verifier });
}
