import { promises as fs } from "fs";
import path from "path";
import type { PoolClient } from "pg";
import { pool } from "./db";
import { envNum } from "./env";

const STORAGE_DIR = "/data/files";
const SWEEP_INTERVAL_MS = envNum("SWEEP_INTERVAL_MS");

const NOTIF_RETENTION_DAYS = envNum("NOTIF_RETENTION_DAYS");

const AI_GRANT_RETENTION_HOURS = envNum("AI_GRANT_RETENTION_HOURS");

async function unlinkBlobs(names: string[]): Promise<void> {
  await Promise.all(
    names.map((n) => fs.unlink(path.join(STORAGE_DIR, n)).catch(() => {}))
  );
}

// Encrypted objects on disk without a row in `files` (e.g. the process died between
// writing the object and committing the transaction). Younger files are skipped so
// uploads that are still in progress are never touched.
const ORPHAN_GRACE_MS = 60 * 60 * 1000;

async function sweepOrphanBlobs(): Promise<void> {
  const names = await fs.readdir(STORAGE_DIR);
  if (names.length === 0) return;
  const known = await pool.query(
    "SELECT stored_name FROM files WHERE stored_name = ANY($1)", [names]);
  const referenced = new Set(known.rows.map((r: { stored_name: string }) => r.stored_name));
  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  for (const name of names) {
    if (referenced.has(name)) continue;
    const st = await fs.stat(path.join(STORAGE_DIR, name)).catch(() => null);
    if (st?.isFile() && st.mtimeMs < cutoff) {
      await fs.unlink(path.join(STORAGE_DIR, name)).catch(() => {});
    }
  }
}

export async function sweepExpired(): Promise<void> {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const blobs = await client.query(
      `WITH RECURSIVE expired_roots AS (
         SELECT id FROM folders WHERE expires_at IS NOT NULL AND expires_at <= now()
       ),
       subtree AS (
         SELECT id FROM expired_roots
         UNION ALL
         SELECT f.id FROM folders f JOIN subtree s ON f.parent_id = s.id
       )
       SELECT stored_name FROM files
        WHERE folder_id IN (SELECT id FROM subtree)
           OR (expires_at IS NOT NULL AND expires_at <= now())`
    );

    const purgedBlobs = await client.query(
      `SELECT stored_name FROM files
        WHERE user_id IN (SELECT id FROM users WHERE purge_after IS NOT NULL AND purge_after <= now())`
    );

    await client.query(
      "DELETE FROM folders WHERE expires_at IS NOT NULL AND expires_at <= now()"
    );

    await client.query(
      "DELETE FROM files WHERE expires_at IS NOT NULL AND expires_at <= now()"
    );

    await client.query(
      "DELETE FROM shares WHERE expires_at IS NOT NULL AND expires_at <= now()"
    );

    await client.query(
      "DELETE FROM login_requests WHERE expires_at <= now()"
    );

    await client.query(
      "DELETE FROM token_sessions WHERE expires_at <= now()"
    );

    await client.query(
      `DELETE FROM notifications WHERE created_at < now() - make_interval(days => $1)`,
      [NOTIF_RETENTION_DAYS]
    );

    await client.query(
      `DELETE FROM ai_processing_requests
        WHERE (consumed = true OR expires_at <= now())
          AND created_at < now() - make_interval(hours => $1)`,
      [AI_GRANT_RETENTION_HOURS]
    );

    await client.query(
      `DELETE FROM file_keys sk
        WHERE sk.user_id <> (SELECT f.user_id FROM files f WHERE f.id = sk.file_id)
          AND NOT EXISTS (
            SELECT 1 FROM shares s
             WHERE s.shared_with = sk.user_id
               AND (s.expires_at IS NULL OR s.expires_at > now())
               AND ( s.file_id = sk.file_id
                     OR s.folder_id = (SELECT f2.folder_id FROM files f2 WHERE f2.id = sk.file_id) )
          )`
    );

    await client.query(
      "DELETE FROM users WHERE purge_after IS NOT NULL AND purge_after <= now()"
    );

    await client.query("COMMIT");
    await unlinkBlobs([
      ...blobs.rows.map((r: { stored_name: string }) => r.stored_name),
      ...purgedBlobs.rows.map((r: { stored_name: string }) => r.stored_name),
    ]);
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("[sweeper] sweep failed:", (err as Error).message);
  } finally {
    client?.release();
  }
  try {
    await sweepOrphanBlobs();
  } catch (err) {
    console.error("[sweeper] orphan sweep failed:", (err as Error).message);
  }
}

export function startSweeper(): void {

  setTimeout(() => void sweepExpired(), 5_000).unref?.();
  setInterval(() => void sweepExpired(), SWEEP_INTERVAL_MS).unref?.();
  console.log(`[sweeper] started (every ${SWEEP_INTERVAL_MS} ms)`);
}
