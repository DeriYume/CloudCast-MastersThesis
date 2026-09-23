"use strict";

module.exports = function randomHex(bytes) {
  const buf = new Uint8Array(bytes);
  for (let off = 0; off < buf.length; off += 65536) {
    globalThis.crypto.getRandomValues(buf.subarray(off, Math.min(off + 65536, buf.length)));
  }
  let out = "";
  for (let i = 0; i < buf.length; i++) out += buf[i].toString(16).padStart(2, "0");
  return out;
};
