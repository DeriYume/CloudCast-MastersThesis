import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";

import randomHex from "crypto-random-hex";
import * as srpClient from "secure-remote-password/client";
import * as srpServer from "secure-remote-password/server";

describe("crypto-random-hex shim", () => {
  it("matches node randomBytes(n).toString('hex') in shape", () => {
    for (const n of [1, 16, 32, 64]) {
      const ours = randomHex(n);
      const theirs = randomBytes(n).toString("hex");
      expect(ours).toHaveLength(theirs.length);
      expect(ours).toHaveLength(n * 2);
      expect(ours).toMatch(/^[0-9a-f]+$/);
    }
  });

  it("returns a different value each call", () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomHex(32)));
    expect(seen.size).toBe(50);
  });

  it("handles sizes above the 65536-byte getRandomValues limit", () => {
    const big = randomHex(70000);
    expect(big).toHaveLength(140000);
    expect(big).toMatch(/^[0-9a-f]+$/);
  });
});

describe("SRP-6a still works with the shim in place", () => {
  it("completes a full client/server handshake", () => {
    const username = "user@example.com";
    const password = "example-vector-password";

    const salt = srpClient.generateSalt();
    expect(salt).toMatch(/^[0-9a-f]+$/);

    const privateKey = srpClient.derivePrivateKey(salt, username, password);
    const verifier = srpClient.deriveVerifier(privateKey);

    const clientEphemeral = srpClient.generateEphemeral();
    const serverEphemeral = srpServer.generateEphemeral(verifier);

    const clientSession = srpClient.deriveSession(
      clientEphemeral.secret, serverEphemeral.public, salt, username, privateKey
    );

    const serverSession = srpServer.deriveSession(
      serverEphemeral.secret, clientEphemeral.public, salt, username, verifier, clientSession.proof
    );

    srpClient.verifySession(clientEphemeral.public, clientSession, serverSession.proof);
    expect(clientSession.key).toBe(serverSession.key);
  });

  it("rejects the wrong password", () => {
    const username = "user@example.com";
    const salt = srpClient.generateSalt();
    const verifier = srpClient.deriveVerifier(
      srpClient.derivePrivateKey(salt, username, "right password")
    );

    const wrongKey = srpClient.derivePrivateKey(salt, username, "wrong password");
    const clientEphemeral = srpClient.generateEphemeral();
    const serverEphemeral = srpServer.generateEphemeral(verifier);
    const clientSession = srpClient.deriveSession(
      clientEphemeral.secret, serverEphemeral.public, salt, username, wrongKey
    );

    expect(() =>
      srpServer.deriveSession(
        serverEphemeral.secret, clientEphemeral.public, salt, username, verifier, clientSession.proof
      )
    ).toThrow();
  });
});
