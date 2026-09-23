import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const MAGIC = Buffer.from("CCE3", "ascii");
const NONCE_PREFIX_LEN = 7;
const IV_LEN = 12;
const TAG_LEN = 16;
const DEFAULT_CHUNK = 256 * 1024;
const HEADER_LEN = MAGIC.length + NONCE_PREFIX_LEN + 4 + 8;

function chunkNonce(prefix: Buffer, index: number, isFinal: boolean): Buffer {
  const nonce = Buffer.alloc(IV_LEN);
  prefix.copy(nonce, 0);
  nonce.writeUInt32BE(index, NONCE_PREFIX_LEN);
  nonce[IV_LEN - 1] = isFinal ? 1 : 0;
  return nonce;
}
function totalChunksFor(plaintextLen: number, chunkSize: number): number {
  return plaintextLen === 0 ? 1 : Math.ceil(plaintextLen / chunkSize);
}
function buildHeader(noncePrefix: Buffer, chunkSize: number, plaintextLen: number): Buffer {
  const h = Buffer.alloc(HEADER_LEN);
  let o = 0;
  MAGIC.copy(h, o); o += MAGIC.length;
  noncePrefix.copy(h, o); o += NONCE_PREFIX_LEN;
  h.writeUInt32BE(chunkSize, o); o += 4;
  h.writeBigUInt64BE(BigInt(plaintextLen), o);
  return h;
}
interface Parsed { header: Buffer; noncePrefix: Buffer; chunkSize: number; plaintextLen: number; total: number; }
function parseHeader(buf: Buffer): Parsed {
  if (buf.length < HEADER_LEN || !buf.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Unrecognized or corrupt CCE3 file.");
  const header = buf.subarray(0, HEADER_LEN);
  const noncePrefix = header.subarray(4, 11);
  const chunkSize = header.readUInt32BE(11);
  const plaintextLen = Number(header.readBigUInt64BE(15));
  return { header, noncePrefix, chunkSize, plaintextLen, total: totalChunksFor(plaintextLen, chunkSize) };
}

export function encryptFile(plaintext: Buffer, dek: Buffer, chunkSize: number = DEFAULT_CHUNK): Buffer {
  const noncePrefix = randomBytes(NONCE_PREFIX_LEN);
  const total = totalChunksFor(plaintext.length, chunkSize);
  const header = buildHeader(noncePrefix, chunkSize, plaintext.length);
  const parts: Buffer[] = [header];
  for (let i = 0; i < total; i++) {
    const isFinal = i === total - 1;
    const pt = plaintext.subarray(i * chunkSize, Math.min((i + 1) * chunkSize, plaintext.length));
    const cipher = createCipheriv(ALGO, dek, chunkNonce(noncePrefix, i, isFinal));
    cipher.setAAD(header);
    parts.push(cipher.update(pt), cipher.final(), cipher.getAuthTag());
  }
  return Buffer.concat(parts);
}

function decryptChunk(buf: Buffer, p: Parsed, dek: Buffer, index: number): Buffer {
  const isFinal = index === p.total - 1;
  const plainLen = isFinal ? p.plaintextLen - index * p.chunkSize : p.chunkSize;
  const offset = HEADER_LEN + index * (p.chunkSize + TAG_LEN);
  const ct = buf.subarray(offset, offset + plainLen);
  const tag = buf.subarray(offset + plainLen, offset + plainLen + TAG_LEN);
  if (ct.length !== plainLen || tag.length !== TAG_LEN) throw new Error("CCE3 file is truncated");
  const d = createDecipheriv(ALGO, dek, chunkNonce(p.noncePrefix, index, isFinal));
  d.setAAD(p.header);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

export function decryptFile(cipher: Buffer, dek: Buffer): Buffer {
  const p = parseHeader(cipher);
  const parts: Buffer[] = [];
  for (let i = 0; i < p.total; i++) parts.push(decryptChunk(cipher, p, dek, i));
  return Buffer.concat(parts);
}
