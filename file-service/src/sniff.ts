const SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> = [

  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/bmp", bytes: [0x42, 0x4d] },
  { mime: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  { mime: "image/tiff", bytes: [0x49, 0x49, 0x2a, 0x00] },
  { mime: "image/tiff", bytes: [0x4d, 0x4d, 0x00, 0x2a] },

  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mime: "application/gzip", bytes: [0x1f, 0x8b] },

  { mime: "video/mp4", bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { mime: "audio/mpeg", bytes: [0x49, 0x44, 0x33] },
  { mime: "application/octet-stream", bytes: [0x7f, 0x45, 0x4c, 0x46] },
];

function matches(buf: Buffer, sig: { bytes: number[]; offset?: number }): boolean {
  const at = sig.offset ?? 0;
  if (buf.length < at + sig.bytes.length) return false;
  for (let i = 0; i < sig.bytes.length; i++) if (buf[at + i] !== sig.bytes[i]) return false;
  return true;
}

function looksLikeText(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  if (sample.length === 0) return true;
  if (sample.includes(0)) return false;

  let printable = 0;
  for (const b of sample) {

    if (b === 0x09 || b === 0x0a || b === 0x0d || b >= 0x20) printable++;
  }
  return printable / sample.length > 0.9;
}

export function sniffMime(buf: Buffer): string {
  for (const sig of SIGNATURES) if (matches(buf, sig)) return sig.mime;
  if (looksLikeText(buf)) return "text/plain";
  return "application/octet-stream";
}
