import { readFileSync } from "fs";
import { createHash } from "crypto";
import { describe, it, expect, beforeAll } from "vitest";
import * as srpClient from "secure-remote-password/client";
import * as cc from "../../src/features/crypto/sodium";

const VECTORS_PATH = new URL("../../../crypto-core/srp-vectors.json", import.meta.url);

let v: Record<string, string>;
const V = (k: string) => {
  const value = v[k];
  if (value === undefined) throw new Error(`vector '${k}' not found in srp-vectors.json`);
  return value;
};

beforeAll(() => {
  try {
    const parsed = JSON.parse(readFileSync(VECTORS_PATH, "utf8")) as Record<string, unknown>;
    v = { ...(parsed.params as Record<string, string>),
          ...(parsed.inputs as Record<string, string>),
          ...(parsed.expected as Record<string, string>) };
  } catch (e) {
    throw new Error(
      `crypto-core/srp-vectors.json not found or unreadable at ${VECTORS_PATH}. ` +
      `Regenerate with \`node crypto-core/srpvectors.mjs\`. (${String(e)})`,
    );
  }
});

describe("group parameters", () => {
  it("the multiplier k hashes an UNPADDED g, as the server's library does", () => {
    const N = Buffer.from(V("N_hex"), "hex");
    const k = createHash("sha256").update(N).update(Buffer.from([0x02])).digest("hex");
    expect(k).toBe(V("k_hex"));
  });

  it("the verifier is the full width of the modulus", () => {
    expect(srpClient.deriveVerifier(V("x_hex")).length).toBe(V("N_hex").length);
  });
});

describe("password stretching", () => {
  it("reproduces the shared stretched password, so both clients agree", async () => {
    await cc.ready();
    expect(cc.srpPassword(V("password"), V("salt_hex"))).toBe(V("stretchedPassword_hex"));
  });

  it("binds the stretched password to the salt", async () => {
    await cc.ready();
    expect(cc.srpPassword(V("password"), "00".repeat(32)))
      .not.toBe(cc.srpPassword(V("password"), "11".repeat(32)));
  });

  it("costs Argon2id, not a single hash, so a leaked verifier is expensive to attack", async () => {
    await cc.ready();
    const started = Date.now();
    cc.srpPassword(V("password"), V("salt_hex"));
    expect(Date.now() - started).toBeGreaterThan(20);
  });
});

describe("registration derivation", () => {
  it("derives the private key x from salt, identity and the stretched password", () => {
    expect(V("x_hex")).toHaveLength(64);
    expect(srpClient.derivePrivateKey(V("salt_hex"), V("identity"), V("stretchedPassword_hex"))).toBe(V("x_hex"));
  });

  it("derives the verifier the server stores", () => {
    expect(srpClient.deriveVerifier(V("x_hex"))).toBe(V("verifier_hex"));
  });

  it("binds the verifier to the password", () => {
    const other = srpClient.deriveVerifier(
      srpClient.derivePrivateKey(V("salt_hex"), V("identity"), "not the password"));
    expect(other).not.toBe(V("verifier_hex"));
  });

  it("binds the verifier to the identity", () => {
    const other = srpClient.deriveVerifier(
      srpClient.derivePrivateKey(V("salt_hex"), "someone@else.com", V("stretchedPassword_hex")));
    expect(other).not.toBe(V("verifier_hex"));
  });
});

describe("the login exchange", () => {
  it("derives the same session key the server derives", () => {
    const s = srpClient.deriveSession(
      V("client_secret_a_hex"), V("B_hex"), V("salt_hex"), V("identity"), V("x_hex"));
    expect(s.key).toBe(V("sessionKey_hex"));
  });

  it("generates a public ephemeral A of the modulus width", () => {
    expect(V("A_hex").length).toBe(V("N_hex").length);
    expect(srpClient.generateEphemeral().public.length).toBe(V("N_hex").length);
  });

  it("produces the proof M1 the server expects", () => {
    const s = srpClient.deriveSession(
      V("client_secret_a_hex"), V("B_hex"), V("salt_hex"), V("identity"), V("x_hex"));
    expect(s.proof).toBe(V("clientProof_M1_hex"));
  });

  it("accepts the server's proof M2, completing mutual authentication", () => {
    const s = srpClient.deriveSession(
      V("client_secret_a_hex"), V("B_hex"), V("salt_hex"), V("identity"), V("x_hex"));
    expect(() => srpClient.verifySession(V("A_hex"), s, V("serverProof_M2_hex"))).not.toThrow();
  });

  it("rejects a forged server proof (a server that does not hold the verifier)", () => {
    const s = srpClient.deriveSession(
      V("client_secret_a_hex"), V("B_hex"), V("salt_hex"), V("identity"), V("x_hex"));
    const forged = V("serverProof_M2_hex").replace(/^./, (c) => (c === "a" ? "b" : "a"));
    expect(() => srpClient.verifySession(V("A_hex"), s, forged)).toThrow();
  });

  it("a wrong password yields a different session key, so the proof fails", () => {
    const wrongX = srpClient.derivePrivateKey(V("salt_hex"), V("identity"), "wrong");
    const s = srpClient.deriveSession(
      V("client_secret_a_hex"), V("B_hex"), V("salt_hex"), V("identity"), wrongX);
    expect(s.key).not.toBe(V("sessionKey_hex"));
  });
});
