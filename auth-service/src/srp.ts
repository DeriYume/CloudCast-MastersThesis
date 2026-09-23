import * as srpServer from "secure-remote-password/server";
import { randomUUID, createHmac } from "crypto";

const DECOY_USER_ID = "00000000-0000-0000-0000-000000000000";

interface Handshake {
  userId: string;
  email: string;
  salt: string;
  verifier: string;
  serverSecret: string;
  expiresAt: number;
  decoy: boolean;
}
const store = new Map<string, Handshake>();
const HANDSHAKE_TTL_MS = 2 * 60 * 1000;

function sweep(): void {
  const now = Date.now();
  for (const [k, v] of store) if (v.expiresAt <= now) store.delete(k);
}

export interface Challenge {
  challengeId: string;
  salt: string;
  serverPublic: string;
}

export function startChallenge(
  userId: string,
  email: string,
  salt: string,
  verifier: string
): Challenge {
  sweep();
  const eph = srpServer.generateEphemeral(verifier);
  const challengeId = randomUUID();
  store.set(challengeId, {
    userId, email, salt, verifier,
    serverSecret: eph.secret,
    expiresAt: Date.now() + HANDSHAKE_TTL_MS,
    decoy: false,
  });
  return { challengeId, salt, serverPublic: eph.public };
}

function pepper(): Buffer {
  const hex = process.env.BLIND_INDEX_PEPPER;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("BLIND_INDEX_PEPPER must be 64 hex chars (openssl rand -hex 32)");
  }
  return Buffer.from(hex, "hex");
}

export function decoyBytes(label: string, email: string, len: number): Buffer {
  const key = pepper();
  const out = Buffer.alloc(len);
  let off = 0;
  for (let counter = 0; off < len; counter++) {
    const block = createHmac("sha256", key).update(`${label}:${counter}:${email}`, "utf8").digest();
    block.copy(out, off, 0, Math.min(block.length, len - off));
    off += block.length;
  }
  return out;
}

export function startDecoyChallenge(email: string): Challenge {
  const salt = decoyBytes("srp-salt", email, 32).toString("hex");
  const verifier = decoyBytes("srp-verifier", email, 32).toString("hex");
  const challenge = startChallenge(DECOY_USER_ID, email, salt, verifier);
  const hs = store.get(challenge.challengeId);
  if (hs) hs.decoy = true;
  return challenge;
}

export interface AuthResult {
  userId: string;
  serverProof: string;
}

export function verifyProof(
  challengeId: string,
  clientPublic: string,
  clientProof: string
): AuthResult | null {
  sweep();
  const hs = store.get(challengeId);
  if (!hs || hs.expiresAt <= Date.now()) return null;
  store.delete(challengeId);
  try {
    const session = srpServer.deriveSession(
      hs.serverSecret, clientPublic, hs.salt, hs.email, hs.verifier, clientProof
    );
    if (hs.decoy) return null;
    return { userId: hs.userId, serverProof: session.proof };
  } catch {
    return null;
  }
}
