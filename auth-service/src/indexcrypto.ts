import { createHmac, createCipheriv, createDecipheriv, randomBytes } from "crypto";

const IV_LEN = 12;
const TAG_LEN = 16;

function pepper(): Buffer {
  const hex = process.env.BLIND_INDEX_PEPPER;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("BLIND_INDEX_PEPPER must be 64 hex chars (openssl rand -hex 32)");
  }
  return Buffer.from(hex, "hex");
}

function emailKey(): Buffer {
  const hex = process.env.EMAIL_ENC_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("EMAIL_ENC_KEY must be 64 hex chars (openssl rand -hex 32)");
  }
  return Buffer.from(hex, "hex");
}

export function blindIndex(normalized: string): Buffer {
  return createHmac("sha256", pepper()).update(normalized, "utf8").digest();
}

function seal(plain: string, key: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

function open(buf: Buffer, key: Buffer): string {
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

export function sealEmail(email: string): Buffer {
  return seal(email, emailKey());
}
export function openEmail(buf: Buffer): string {
  return open(buf, emailKey());
}

export function assertIndexSecrets(): void {
  pepper();
  emailKey();
}
