#!/usr/bin/env node
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const req = createRequire(join(ROOT, "auth-service", "package.json"));

const srpClient = req("secure-remote-password/client");
const srpServer = req("secure-remote-password/server");
const params = req("secure-remote-password/lib/params");
const SRPInteger = req("secure-remote-password/lib/srp-integer");

const I = "user@example.com";
const p = "example-vector-password";
const salt = "11".repeat(32);
const a = "22".repeat(32);
const b = "33".repeat(32);

const { N, g, k, H } = params;

// The password is stretched with Argon2id before it enters the SRP derivation,
// so that a leaked verifier costs as much to attack as the vault itself.
const _sodium = createRequire(join(HERE, "package.json"))("libsodium-wrappers-sumo");
await _sodium.ready;
const sodium = _sodium;
const SRP_STRETCH_CONTEXT = "cloudcast-srp-v1:";
const ARGON2ID = { OPS: 3, MEM: 67108864, SALTBYTES: 16, KEYBYTES: 32 };
const stretch = (password, saltHex) =>
  sodium.to_hex(
    sodium.crypto_pwhash(
      ARGON2ID.KEYBYTES,
      password,
      sodium.crypto_generichash(ARGON2ID.SALTBYTES, sodium.from_string(SRP_STRETCH_CONTEXT + saltHex)),
      ARGON2ID.OPS,
      ARGON2ID.MEM,
      sodium.crypto_pwhash_ALG_ARGON2ID13,
    ),
  );
const stretched = stretch(p, salt);

const x = srpClient.derivePrivateKey(salt, I, stretched);
const v = srpClient.deriveVerifier(x);

const A = g.modPow(SRPInteger.fromHex(a), N).toHex();

const B = k
  .multiply(SRPInteger.fromHex(v))
  .add(g.modPow(SRPInteger.fromHex(b), N))
  .mod(N)
  .toHex();

const clientSession = srpClient.deriveSession(a, B, salt, I, x);

const serverSession = srpServer.deriveSession(b, A, salt, I, v, clientSession.proof);

srpClient.verifySession(A, clientSession, serverSession.proof);

const vectors = {
  note:
    "SRP-6a interop gate. Generated from the SERVER'S OWN library (secure-remote-password, " +
    "SHA-256, RFC 5054 2048-bit group) by crypto-core/srpvectors.mjs. A client port is correct " +
    "when it reproduces every `expected` value from `inputs`. Note k hashes g UNPADDED (1 byte). " +
    "x is derived from the Argon2id-stretched password: " +
    "stretched = argon2id(password, generichash16(stretch_context + salt_hex)), hex-encoded.",
  params: {
    hash: "SHA-256",
    group: "RFC 5054 2048-bit",
    N_hex: N.toHex(),
    g_hex: g.toHex(),
    k_hex: k.toHex(),
    N_bytes: N.toHex().length / 2,
    padding:
      "A, B, S are left-padded to N_bytes. s and the 32-byte hash outputs are NOT padded. " +
      "g is hashed as the single byte 0x02.",
  },
  inputs: {
    identity: I,
    password: p,
    salt_hex: salt,
    stretch_context: SRP_STRETCH_CONTEXT,
    argon2id: { ops: ARGON2ID.OPS, mem: ARGON2ID.MEM, salt_bytes: ARGON2ID.SALTBYTES, key_bytes: ARGON2ID.KEYBYTES },
    client_secret_a_hex: a,
    server_secret_b_hex: b,
  },
  expected: {
    stretchedPassword_hex: stretched,
    x_hex: x,
    verifier_hex: v,
    A_hex: A,
    B_hex: B,
    sessionKey_hex: clientSession.key,
    clientProof_M1_hex: clientSession.proof,
    serverProof_M2_hex: serverSession.proof,
  },
};

writeFileSync(join(HERE, "srp-vectors.json"), JSON.stringify(vectors, null, 2) + "\n");

const checks = [
  ["k = H(N, g) with g unpadded", H(N, g).toHex() === k.toHex()],
  ["A is padded to N length", A.length === N.toHex().length],
  ["B is padded to N length", B.length === N.toHex().length],
  ["x is 32 bytes", x.length === 64],
  ["stretched password is 32 bytes", stretched.length === 64],
  ["server accepted the client proof", !!serverSession.proof],
];
let fail = 0;
for (const [name, ok] of checks) {
  if (!ok) fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}`);
}
console.log(`\nwrote crypto-core/srp-vectors.json - ${checks.length - fail}/${checks.length} checks passed`);
process.exit(fail ? 1 : 0);
