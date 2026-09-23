import _sodium from "libsodium-wrappers-sumo";

let sodium: typeof _sodium | null = null;
export async function ready(): Promise<void> {
  if (!sodium) { await _sodium.ready; sodium = _sodium; }
}
function S(): typeof _sodium {
  if (!sodium) throw new Error("crypto-core not initialised - await ready() first");
  return sodium;
}

export function randomBytes(n: number): Buffer { return Buffer.from(S().randombytes_buf(n)); }

export function sealTo(message: Buffer, recipientPk: Buffer): Buffer { return Buffer.from(S().crypto_box_seal(message, recipientPk)); }
