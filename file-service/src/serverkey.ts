import * as cc from "./sodiumcrypto";

let sk: Buffer | null = null;
let pk: Buffer | null = null;

export function loadServerKey(): void {
  const b64 = process.env.SERVER_X25519_SK;
  if (!b64) throw new Error("SERVER_X25519_SK is not set (base64 of a 32-byte X25519 secret key)");
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 32) throw new Error("SERVER_X25519_SK must decode to exactly 32 bytes");
  sk = buf;
  pk = cc.publicFromSecret(buf);
}

export function serverSecret(): Buffer {
  if (!sk) throw new Error("server key not loaded - call loadServerKey() at startup");
  return sk;
}
export function serverPublic(): Buffer {
  if (!pk) throw new Error("server key not loaded - call loadServerKey() at startup");
  return pk;
}
