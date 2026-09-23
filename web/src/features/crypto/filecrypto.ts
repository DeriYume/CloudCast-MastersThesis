import { UserError } from "../../utils/errors";

const MAGIC = new Uint8Array([0x43, 0x43, 0x45, 0x33]);
const NONCE_PREFIX_LEN = 7;
const IV_LEN = 12;
const TAG_LEN = 16;
const DEFAULT_CHUNK = 256 * 1024;
const HEADER_LEN = 4 + NONCE_PREFIX_LEN + 4 + 8;

function eq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
type Bytes = Uint8Array<ArrayBuffer>;

function concat(parts: Uint8Array[]): Bytes {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function chunkNonce(prefix: Uint8Array, index: number, isFinal: boolean): Bytes {
  const nonce = new Uint8Array(IV_LEN);
  nonce.set(prefix, 0);
  new DataView(nonce.buffer).setUint32(NONCE_PREFIX_LEN, index, false);
  nonce[IV_LEN - 1] = isFinal ? 1 : 0;
  return nonce;
}
function totalChunksFor(len: number, chunkSize: number): number {
  return len === 0 ? 1 : Math.ceil(len / chunkSize);
}
function buildHeader(prefix: Uint8Array, chunkSize: number, plaintextLen: number): Bytes {
  const h = new Uint8Array(HEADER_LEN);
  h.set(MAGIC, 0);
  h.set(prefix, 4);
  const dv = new DataView(h.buffer);
  dv.setUint32(11, chunkSize, false);
  dv.setBigUint64(15, BigInt(plaintextLen), false);
  return h;
}
interface Parsed { header: Bytes; prefix: Bytes; chunkSize: number; plaintextLen: number; total: number; }
function parseHeader(buf: Uint8Array): Parsed {
  if (buf.length < HEADER_LEN || !eq(buf.subarray(0, 4), MAGIC)) throw new UserError("Unrecognized or corrupt CCE3 file.");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const chunkSize = dv.getUint32(11, false);
  const plaintextLen = Number(dv.getBigUint64(15, false));
  return {
    header: buf.subarray(0, HEADER_LEN) as Bytes,
    prefix: buf.subarray(4, 11) as Bytes,
    chunkSize, plaintextLen, total: totalChunksFor(plaintextLen, chunkSize),
  };
}
async function importKey(dek: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", dek as Bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptFile(plaintext: Uint8Array, dek: Uint8Array, chunkSize: number = DEFAULT_CHUNK): Promise<Bytes> {
  return encryptFileWithPrefix(plaintext, dek, crypto.getRandomValues(new Uint8Array(NONCE_PREFIX_LEN)), chunkSize);
}

export async function encryptFileWithPrefix(
  plaintext: Uint8Array, dek: Uint8Array, prefix: Uint8Array, chunkSize: number = DEFAULT_CHUNK,
): Promise<Bytes> {
  if (prefix.length !== NONCE_PREFIX_LEN) throw new UserError(`nonce prefix must be ${NONCE_PREFIX_LEN} bytes`);
  const total = totalChunksFor(plaintext.length, chunkSize);
  const header = buildHeader(prefix, chunkSize, plaintext.length);
  const key = await importKey(dek);
  const parts: Uint8Array[] = [header];
  for (let i = 0; i < total; i++) {
    const isFinal = i === total - 1;
    const pt = plaintext.subarray(i * chunkSize, Math.min((i + 1) * chunkSize, plaintext.length)) as Bytes;
    const ctTag = new Uint8Array(await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: chunkNonce(prefix, i, isFinal), additionalData: header, tagLength: 128 }, key, pt));
    parts.push(ctTag);
  }
  return concat(parts);
}

export async function decryptFile(cipher: Uint8Array, dek: Uint8Array): Promise<Bytes> {
  const p = parseHeader(cipher);
  const key = await importKey(dek);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < p.total; i++) {
    const isFinal = i === p.total - 1;
    const plainLen = isFinal ? p.plaintextLen - i * p.chunkSize : p.chunkSize;
    const offset = HEADER_LEN + i * (p.chunkSize + TAG_LEN);
    const ctTag = cipher.subarray(offset, offset + plainLen + TAG_LEN) as Bytes;
    const pt = new Uint8Array(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: chunkNonce(p.prefix, i, isFinal), additionalData: p.header, tagLength: 128 }, key, ctTag));
    parts.push(pt);
  }
  return concat(parts);
}

export async function decryptRange(cipher: Uint8Array, dek: Uint8Array, start: number, end: number): Promise<Bytes> {
  const p = parseHeader(cipher);
  if (p.plaintextLen === 0) return new Uint8Array(0) as Bytes;
  start = Math.max(0, start);
  end = Math.min(end, p.plaintextLen - 1);
  if (start > end) return new Uint8Array(0) as Bytes;
  const first = Math.floor(start / p.chunkSize);
  const last = Math.floor(end / p.chunkSize);
  const key = await importKey(dek);
  const parts: Uint8Array[] = [];
  for (let i = first; i <= last; i++) {
    const isFinal = i === p.total - 1;
    const plainLen = isFinal ? p.plaintextLen - i * p.chunkSize : p.chunkSize;
    const offset = HEADER_LEN + i * (p.chunkSize + TAG_LEN);
    const ctTag = cipher.subarray(offset, offset + plainLen + TAG_LEN) as Bytes;
    parts.push(new Uint8Array(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: chunkNonce(p.prefix, i, isFinal), additionalData: p.header, tagLength: 128 }, key, ctTag)));
  }
  const buf = concat(parts);
  const s0 = start - first * p.chunkSize;
  return buf.subarray(s0, s0 + (end - start) + 1) as Bytes;
}

export function plaintextLength(cipher: Uint8Array): number {
  return parseHeader(cipher).plaintextLen;
}
