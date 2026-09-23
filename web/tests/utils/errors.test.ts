import { describe, it, expect } from "vitest";

import { friendlyError, httpStatus, UserError } from "../../src/utils/errors";
import { genericHttpMessage, type ApiError } from "../../src/api/http";

const fallback = "Sign in failed";

function apiError(status: number, serverMessage?: string): ApiError {
  const err = new Error(serverMessage ?? genericHttpMessage(status)) as ApiError;
  err.status = status;
  return err;
}

function expectNoDevDetail(msg: string) {
  const leaks = [
    "http://", "https://", "localhost", "127.0.0.1", ":8080", ":4001",
    "TypeError", "DOMException", "undefined", "null", "fetch",
  ];
  for (const leak of leaks) {
    expect(msg.toLowerCase(), `leaked "${leak}" into: ${msg}`).not.toContain(leak.toLowerCase());
  }
  expect(msg.length, `message should be a sentence: ${msg}`).toBeGreaterThan(10);
}

describe("friendlyError", () => {
  it("prefers the server's own message and passes it through verbatim", () => {
    expect(friendlyError(apiError(401, "Authentication failed"), fallback)).toBe("Authentication failed");
  });

  it("replaces the generic 'Request failed (N)' with something a person can act on", () => {
    const msg = friendlyError(apiError(503), fallback);
    expect(msg).not.toContain("Request failed");
    expect(msg.toLowerCase()).toContain("server");
    expectNoDevDetail(msg);
  });

  it("maps 429 to a rate-limit message", () => {
    expect(friendlyError(apiError(429), fallback).toLowerCase()).toContain("too many");
  });

  it("falls back for client statuses it has no better wording for", () => {
    expect(friendlyError(apiError(418), fallback)).toBe(fallback);
  });

  it("turns a failed fetch into a connectivity message, not the browser's words", () => {
    const msg = friendlyError(new TypeError("Failed to fetch"), fallback);
    expect(msg).not.toContain("Failed to fetch");
    expect(msg.toLowerCase()).toContain("connection");
    expectNoDevDetail(msg);
  });

  it("recognises the Firefox and Safari wordings too", () => {
    for (const raw of ["NetworkError when attempting to fetch resource.", "Load failed"]) {
      const msg = friendlyError(new TypeError(raw), fallback);
      expect(msg.toLowerCase()).toContain("connection");
      expect(msg).not.toBe(raw);
    }
  });

  it("reports an aborted request as a timeout", () => {
    const abort = new DOMException("The operation was aborted.", "AbortError");
    expect(friendlyError(abort, fallback).toLowerCase()).toContain("too long");
  });

  it("passes through our own deliberate user-facing messages", () => {
    expect(friendlyError(new UserError("That password isn't right."), fallback)).toBe("That password isn't right.");
    expect(friendlyError(new UserError("Your keys are locked - please sign in again."), fallback))
      .toBe("Your keys are locked - please sign in again.");
  });

  it("uses the caller's fallback for unrecognised failures, never their message", () => {
    expect(friendlyError(new Error("x.y is not a function"), fallback)).toBe(fallback);
    expect(friendlyError(new RangeError("Maximum call stack size exceeded"), fallback)).toBe(fallback);
    expect(friendlyError(new Error("crypto not initialised - await ready() first"), fallback)).toBe(fallback);
  });

  it("handles non-Error values without throwing", () => {
    expect(friendlyError(undefined, fallback)).toBe(fallback);
    expect(friendlyError(null, fallback)).toBe(fallback);
    expect(friendlyError("a bare string", fallback)).toBe(fallback);
    expect(friendlyError({ nope: true }, fallback)).toBe(fallback);
  });
});

describe("httpStatus", () => {
  it("reports the code so callers can still branch on it", () => {
    expect(httpStatus(apiError(503))).toBe(503);
    expect(httpStatus(apiError(415))).toBe(415);
  });

  it("returns null for non-HTTP failures", () => {
    expect(httpStatus(new TypeError("Failed to fetch"))).toBeNull();
    expect(httpStatus(new UserError("nope"))).toBeNull();
  });
});
