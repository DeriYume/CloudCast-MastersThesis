import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { randomUUID, randomBytes, createHash } from "crypto";
import { pool } from "./db";
import * as srp from "./srp";
import { blindIndex, sealEmail, openEmail } from "./indexcrypto";
import * as cc from "./sodiumcrypto";
import { envNum } from "./env";

export const router = Router();

const JWT_SECRET = process.env.JWT_SECRET as string;
const TOKEN_TTL = "24h";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const DECOY_USER_ID = "00000000-0000-0000-0000-000000000000";
const PURGE_GRACE_DAYS = envNum("ACCOUNT_PURGE_GRACE_DAYS");
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const b64ToBuf = (s: unknown): Buffer | null =>
  typeof s === "string" && s.length > 0 ? Buffer.from(s, "base64") : null;
const bufToB64 = (b: Buffer): string => b.toString("base64");
const hexToBytea = (s: string): Buffer => Buffer.from(s, "utf8");
const byteaToHex = (b: Buffer): string => b.toString("utf8");

const validEmail = (e: unknown): e is string => typeof e === "string" && EMAIL_REGEX.test(e.trim());
const norm = (e: string) => e.trim().toLowerCase();

function requireB64(body: any, fields: string[]): Record<string, Buffer> | null {
  const out: Record<string, Buffer> = {};
  for (const f of fields) {
    const buf = b64ToBuf(body?.[f]);
    if (!buf) return null;
    out[f] = buf;
  }
  return out;
}

async function authenticate(req: Request): Promise<{ userId: string; jti?: string } | null> {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  let payload: { sub: string; jti?: string };
  try { payload = jwt.verify(token, JWT_SECRET) as typeof payload; } catch { return null; }
  if (payload.jti) {
    const s = await pool.query("SELECT 1 FROM token_sessions WHERE jti = $1", [payload.jti]);
    if (!s.rowCount) return null;
  }
  return { userId: payload.sub, jti: payload.jti };
}

async function issueSession(userId: string, keyEpoch: number): Promise<string> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await pool.query(
    "INSERT INTO token_sessions (jti, user_id, key_epoch, expires_at) VALUES ($1,$2,$3,$4)",
    [jti, userId, keyEpoch, expiresAt]
  );
  return jwt.sign({ sub: userId, jti }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

router.post("/register", async (req: Request, res: Response) => {
  const b = req.body ?? {};
  if (!validEmail(b.email)) return res.status(400).json({ error: "Invalid email" });
  if (typeof b.srp_salt !== "string" || typeof b.srp_verifier !== "string")
    return res.status(400).json({ error: "Missing SRP credentials" });
  const bin = requireB64(b, ["public_key", "encrypted_private_key", "recovery_encrypted_private_key", "kdf_salt", "mk_sealed"]);
  if (!bin) return res.status(400).json({ error: "Missing or invalid key material" });

  const email = norm(b.email);

  try {
    const r = await pool.query(
      `INSERT INTO users
         (email_bidx, email_enc, srp_salt, srp_verifier,
          public_key, encrypted_private_key, recovery_encrypted_private_key, kdf_salt, mk_sealed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [blindIndex(email), sealEmail(email),
       hexToBytea(b.srp_salt), hexToBytea(b.srp_verifier),
       bin.public_key, bin.encrypted_private_key, bin.recovery_encrypted_private_key, bin.kdf_salt, bin.mk_sealed]
    );
    return res.status(201).json({ id: r.rows[0].id });
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already registered" });
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
});

router.post("/srp/challenge", async (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  if (!validEmail(email)) return res.status(400).json({ error: "Invalid email" });
  const r = await pool.query(
    "SELECT id, srp_salt, srp_verifier FROM users WHERE email_bidx = $1",
    [blindIndex(norm(email))]
  );
  const user = r.rows[0];

  const ch = user
    ? srp.startChallenge(user.id, norm(email), byteaToHex(user.srp_salt), byteaToHex(user.srp_verifier))
    : srp.startDecoyChallenge(norm(email));
  return res.json({ challengeId: ch.challengeId, salt: ch.salt, serverPublic: ch.serverPublic });
});

router.post("/srp/authenticate", async (req: Request, res: Response) => {
  const { challengeId, clientPublic, clientProof } = req.body ?? {};
  if (typeof challengeId !== "string" || typeof clientPublic !== "string" || typeof clientProof !== "string")
    return res.status(400).json({ error: "Missing handshake fields" });
  const auth = srp.verifyProof(challengeId, clientPublic, clientProof);
  if (!auth) return res.status(401).json({ error: "Authentication failed" });

  const r = await pool.query(
    "SELECT key_epoch, rotation_required, purge_after, public_key, encrypted_private_key, kdf_salt, mk_sealed FROM users WHERE id = $1",
    [auth.userId]
  );
  const u = r.rows[0];
  if (!u) return res.status(404).json({ error: "User not found" });
  const token = await issueSession(auth.userId, u.key_epoch);
  return res.json({
    token,
    serverProof: auth.serverProof,
    rotationRequired: u.rotation_required,

    pendingDeletion: u.purge_after,
    vault: {
      public_key: bufToB64(u.public_key),
      encrypted_private_key: bufToB64(u.encrypted_private_key),
      kdf_salt: bufToB64(u.kdf_salt),
      mk_sealed: bufToB64(u.mk_sealed),
    },
  });
});

interface RecoveryChallenge { userId: string; nonce: Buffer; expiresAt: number; }
const recoveryStore = new Map<string, RecoveryChallenge>();
const RECOVERY_TTL_MS = 5 * 60 * 1000;

router.post("/recover/challenge", async (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  if (!validEmail(email)) return res.status(400).json({ error: "Invalid email" });
  const r = await pool.query(
    "SELECT id, public_key, recovery_encrypted_private_key, kdf_salt FROM users WHERE email_bidx = $1",
    [blindIndex(norm(email))]
  );
  const u = r.rows[0];
  const challengeId = randomUUID();
  const nonce = cc.randomBytes(32);

  if (!u) {
    const e = norm(email);
    recoveryStore.set(challengeId, {
      userId: DECOY_USER_ID, nonce, expiresAt: Date.now() + RECOVERY_TTL_MS,
    });
    return res.json({
      challengeId,
      recovery_encrypted_private_key: srp.decoyBytes("recovery-vault", e, 72).toString("base64"),
      kdf_salt: srp.decoyBytes("recovery-kdf-salt", e, 16).toString("base64"),
      sealed_nonce: srp.decoyBytes("recovery-sealed-nonce", e, 80).toString("base64"),
    });
  }

  const sealedNonce = cc.sealTo(nonce, u.public_key);
  recoveryStore.set(challengeId, { userId: u.id, nonce, expiresAt: Date.now() + RECOVERY_TTL_MS });
  return res.json({
    challengeId,
    recovery_encrypted_private_key: bufToB64(u.recovery_encrypted_private_key),
    kdf_salt: bufToB64(u.kdf_salt),
    sealed_nonce: bufToB64(sealedNonce),
  });
});

router.post("/recover", async (req: Request, res: Response) => {
  const b = req.body ?? {};
  const ch = typeof b.challengeId === "string" ? recoveryStore.get(b.challengeId) : undefined;
  if (!ch || ch.expiresAt <= Date.now()) return res.status(400).json({ error: "Invalid or expired challenge" });
  recoveryStore.delete(b.challengeId);
  const answered = b64ToBuf(b.nonce);
  if (!answered || Buffer.compare(answered, ch.nonce) !== 0)
    return res.status(403).json({ error: "Proof of possession failed" });
  if (typeof b.srp_salt !== "string" || typeof b.srp_verifier !== "string")
    return res.status(400).json({ error: "Missing SRP credentials" });
  const enc = b64ToBuf(b.encrypted_private_key);
  if (!enc) return res.status(400).json({ error: "Missing re-wrapped private key" });

  await pool.query(
    "UPDATE users SET srp_salt=$1, srp_verifier=$2, encrypted_private_key=$3 WHERE id=$4",
    [hexToBytea(b.srp_salt), hexToBytea(b.srp_verifier), enc, ch.userId]
  );
  await pool.query("DELETE FROM token_sessions WHERE user_id = $1", [ch.userId]);
  return res.json({ recovered: true });
});

router.post("/rotate", async (req: Request, res: Response) => {
  const auth = await authenticate(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const b = req.body ?? {};
  if (typeof b.srp_salt !== "string" || typeof b.srp_verifier !== "string")
    return res.status(400).json({ error: "Missing SRP credentials" });
  const bin = requireB64(b, ["public_key", "encrypted_private_key", "recovery_encrypted_private_key", "mk_sealed"]);
  if (!bin) return res.status(400).json({ error: "Missing key material" });

  const cur = await pool.query("SELECT public_key, key_epoch FROM users WHERE id = $1", [auth.userId]);
  const u = cur.rows[0];
  if (!u) return res.status(404).json({ error: "User not found" });
  if (Buffer.compare(u.public_key, bin.public_key) === 0)
    return res.status(400).json({ error: "New public key must differ from the current one" });

  const newEpoch = u.key_epoch + 1;
  await pool.query(
    `UPDATE users SET public_key=$1, encrypted_private_key=$2, recovery_encrypted_private_key=$3,
        mk_sealed=$4, srp_salt=$5, srp_verifier=$6, key_epoch=$7, rotation_required=false WHERE id=$8`,
    [bin.public_key, bin.encrypted_private_key, bin.recovery_encrypted_private_key, bin.mk_sealed,
     hexToBytea(b.srp_salt), hexToBytea(b.srp_verifier), newEpoch, auth.userId]
  );
  await pool.query("DELETE FROM token_sessions WHERE user_id = $1", [auth.userId]);
  const token = await issueSession(auth.userId, newEpoch);
  return res.json({ token, keyEpoch: newEpoch });
});

router.post("/logout", async (req: Request, res: Response) => {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(400).json({ error: "No token provided" });
  let payload: { jti?: string };
  try { payload = jwt.verify(token, JWT_SECRET) as typeof payload; } catch { return res.json({ loggedOut: true }); }
  if (payload.jti) await pool.query("DELETE FROM token_sessions WHERE jti = $1", [payload.jti]);
  return res.json({ loggedOut: true });
});

router.delete("/account", async (req: Request, res: Response) => {
  const auth = await authenticate(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const affected = await client.query(
      `SELECT id, shared_with, file_id, folder_id
         FROM shares
        WHERE owner_id = $1 AND permission = 'save'`,
      [auth.userId]
    );
    const notified = (affected.rowCount ?? 0) > 0;
    const purgeAfter = new Date(Date.now() + PURGE_GRACE_DAYS * 24 * 60 * 60 * 1000);

    await client.query("UPDATE users SET purge_after = $1 WHERE id = $2", [purgeAfter, auth.userId]);

    for (const row of affected.rows) {
      await client.query(
        `INSERT INTO notifications (user_id, type, file_id, folder_id)
         VALUES ($1, 'owner_leaving', $2, $3)`,
        [row.shared_with, row.file_id, row.folder_id]
      );
    }

    await client.query("DELETE FROM token_sessions WHERE user_id = $1", [auth.userId]);
    await client.query("COMMIT");
    return res.json({ scheduled: true, purge_after: purgeAfter, grace_days: PURGE_GRACE_DAYS, notified });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[auth-service] account deletion failed:", e);
    return res.status(500).json({ error: "Could not schedule deletion" });
  } finally {
    client.release();
  }
});

router.post("/account/restore", async (req: Request, res: Response) => {
  const auth = await authenticate(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const r = await pool.query(
    "UPDATE users SET purge_after = NULL WHERE id = $1 AND purge_after IS NOT NULL AND purge_after > now() RETURNING id",
    [auth.userId]
  );
  if (!r.rowCount) return res.status(409).json({ error: "No cancellable deletion for this account" });

  await pool.query(
    `DELETE FROM notifications
      WHERE type = 'owner_leaving'
        AND (   file_id   IN (SELECT id FROM files   WHERE user_id = $1)
             OR folder_id IN (SELECT id FROM folders WHERE user_id = $1) )`,
    [auth.userId]
  );
  return res.json({ restored: true });
});

router.get("/me", async (req: Request, res: Response) => {
  const auth = await authenticate(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const r = await pool.query(
    "SELECT email_enc, rotation_required, created_at, purge_after FROM users WHERE id = $1",
    [auth.userId]
  );
  const u = r.rows[0];
  if (!u) return res.status(404).json({ error: "User not found" });

  return res.json({
    user: {
      id: auth.userId,
      email: openEmail(u.email_enc),
      rotationRequired: u.rotation_required,
      created_at: u.created_at,
      pendingDeletion: u.purge_after,
      graceDays: PURGE_GRACE_DAYS,
    },
  });
});

router.post("/change-password", async (req: Request, res: Response) => {
  const auth = await authenticate(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const b = req.body ?? {};
  if (typeof b.srp_salt !== "string" || typeof b.srp_verifier !== "string")
    return res.status(400).json({ error: "Missing SRP credentials" });
  const enc = b64ToBuf(b.encrypted_private_key);
  if (!enc) return res.status(400).json({ error: "Missing re-wrapped private key" });
  await pool.query(
    "UPDATE users SET srp_salt=$1, srp_verifier=$2, encrypted_private_key=$3 WHERE id=$4",
    [hexToBytea(b.srp_salt), hexToBytea(b.srp_verifier), enc, auth.userId]
  );
  if (auth.jti) await pool.query("DELETE FROM token_sessions WHERE user_id=$1 AND jti<>$2", [auth.userId, auth.jti]);
  return res.json({ changed: true });
});

router.post("/recovery/regenerate", async (req: Request, res: Response) => {
  const auth = await authenticate(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const enc = b64ToBuf(req.body?.recovery_encrypted_private_key);
  if (!enc) return res.status(400).json({ error: "Missing recovery vault" });
  await pool.query("UPDATE users SET recovery_encrypted_private_key=$1 WHERE id=$2", [enc, auth.userId]);
  return res.json({ regenerated: true });
});

router.post("/change-email", async (req: Request, res: Response) => {
  const auth = await authenticate(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const b = req.body ?? {};
  if (!validEmail(b.newEmail)) return res.status(400).json({ error: "Enter a valid email address" });
  if (typeof b.srp_salt !== "string" || typeof b.srp_verifier !== "string")
    return res.status(400).json({ error: "Missing SRP credentials for the new identity" });
  const email = norm(b.newEmail);
  try {
    await pool.query(
      "UPDATE users SET email_bidx=$1, email_enc=$2, srp_salt=$3, srp_verifier=$4 WHERE id=$5",
      [blindIndex(email), sealEmail(email), hexToBytea(b.srp_salt), hexToBytea(b.srp_verifier), auth.userId]
    );
    return res.json({ email });
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already in use" });
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
});

router.get("/users/search", async (req: Request, res: Response) => {
  const auth = await authenticate(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.json({ results: [] });

  const r = await pool.query(
    "SELECT id, public_key FROM users WHERE email_bidx=$1 AND id<>$2 LIMIT 1",
    [blindIndex(norm(q)), auth.userId]
  );
  return res.json({
    results: r.rows.map((row) => ({
      id: row.id,
      public_key: bufToB64(row.public_key),
    })),
  });
});

const QR_TTL_MS = 60 * 1000;

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_CHARS = 8;

function mintCode(): string {
  const bits = BigInt(`0x${randomBytes(5).toString("hex")}`);
  let out = "";
  for (let i = CODE_CHARS - 1; i >= 0; i--) {
    out += CROCKFORD[Number((bits >> BigInt(i * 5)) & 31n)];
  }
  return out;
}

const normCode = (v: unknown): string => {
  if (typeof v !== "string") return "";
  return v
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
};

const hashCode = (code: string): string => createHash("sha256").update(code).digest("hex");

router.post("/qr/offer", async (req: Request, res: Response) => {
  const auth = await authenticate(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const code = mintCode();
  const expiresAt = new Date(Date.now() + QR_TTL_MS);
  await pool.query(
    "INSERT INTO login_requests (code, status, user_id, expires_at) VALUES ($1,'pending',$2,$3)",
    [hashCode(code), auth.userId, expiresAt]);
  return res.json({ code, expiresAt: expiresAt.toISOString() });
});

router.post("/qr/register", async (req: Request, res: Response) => {
  const code = normCode(req.body?.code);
  const transferPk = b64ToBuf(req.body?.transfer_pk);
  if (!code || !transferPk) return res.status(400).json({ error: "code and transfer_pk required" });
  const codeHash = hashCode(code);
  const r = await pool.query("SELECT status, transfer_pk, expires_at FROM login_requests WHERE code=$1", [codeHash]);
  const row = r.rows[0];
  if (!row || row.status !== "pending" || new Date(row.expires_at) <= new Date())
    return res.status(404).json({ error: "That code isn't valid - check the signed-in device." });
  if (row.transfer_pk) return res.status(409).json({ error: "That code is already in use." });

  const upd = await pool.query(
    "UPDATE login_requests SET transfer_pk=$2 WHERE code=$1 AND transfer_pk IS NULL RETURNING code", [codeHash, transferPk]);
  if (!upd.rowCount) return res.status(409).json({ error: "That code is already in use." });
  return res.json({ ok: true });
});

router.get("/qr/pending", async (req: Request, res: Response) => {
  const auth = await authenticate(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const code = normCode(req.query.code);
  if (!code) return res.status(400).json({ error: "code required" });
  const r = await pool.query("SELECT status, user_id, transfer_pk, expires_at FROM login_requests WHERE code=$1", [hashCode(code)]);
  const row = r.rows[0];
  if (!row || row.user_id !== auth.userId) return res.json({ status: "invalid" });
  if (new Date(row.expires_at) <= new Date()) return res.json({ status: "expired" });
  if (row.status === "approved" || row.status === "consumed") return res.json({ status: "done" });
  if (row.transfer_pk) return res.json({ status: "registered", transfer_pk: bufToB64(row.transfer_pk) });
  return res.json({ status: "waiting" });
});

router.post("/qr/approve", async (req: Request, res: Response) => {
  const auth = await authenticate(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const code = normCode(req.body?.code);
  const sealedSk = b64ToBuf(req.body?.sealed_sk);
  if (!code || !sealedSk) return res.status(400).json({ error: "code and sealed_sk required" });
  const codeHash = hashCode(code);
  const r = await pool.query("SELECT status, user_id, transfer_pk, expires_at FROM login_requests WHERE code=$1", [codeHash]);
  const row = r.rows[0];
  if (!row || row.user_id !== auth.userId || !row.transfer_pk || row.status !== "pending" || new Date(row.expires_at) <= new Date())
    return res.status(404).json({ error: "No device is waiting for that code." });
  const u = await pool.query("SELECT key_epoch FROM users WHERE id=$1", [auth.userId]);
  if (!u.rows[0]) return res.status(404).json({ error: "User not found" });
  const token = await issueSession(auth.userId, u.rows[0].key_epoch);

  const sealedToken = bufToB64(Buffer.from(cc.sealTo(Buffer.from(token, "utf8"), row.transfer_pk)));
  await pool.query("UPDATE login_requests SET status='approved', sealed_sk=$2, token=$3 WHERE code=$1", [codeHash, sealedSk, sealedToken]);
  return res.json({ approved: true });
});

router.get("/qr/poll", async (req: Request, res: Response) => {
  const code = normCode(req.query.code);
  if (!code) return res.status(400).json({ error: "code required" });
  const r = await pool.query(
    "SELECT status, user_id, transfer_pk, sealed_sk, token, expires_at FROM login_requests WHERE code=$1", [hashCode(code)]);
  const row = r.rows[0];
  if (!row) return res.json({ status: "invalid" });
  if (row.status === "consumed") return res.json({ status: "consumed" });
  if (new Date(row.expires_at) <= new Date()) return res.json({ status: "expired" });
  if (row.status !== "approved") return res.json({ status: "pending" });

  const u = await pool.query("SELECT public_key, mk_sealed FROM users WHERE id=$1", [row.user_id]);
  const user = u.rows[0];
  if (!user) return res.json({ status: "invalid" });

  await pool.query(
    "UPDATE login_requests SET status='consumed', token=NULL, sealed_sk=NULL WHERE code=$1", [hashCode(code)]);
  return res.json({
    status: "approved",
    sealed_token: row.token,
    sealed_sk: bufToB64(row.sealed_sk),
    public_key: bufToB64(user.public_key),
    mk_sealed: bufToB64(user.mk_sealed),
  });
});

export default router;
