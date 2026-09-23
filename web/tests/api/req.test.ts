import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { req, BASE, setUnauthorizedHandler } from "../../src/api/http";

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("req", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
  });

  it("prefixes BASE and sends the bearer token", async () => {
    await req("GET", "/files/abc", "tok123");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/files/abc`);
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ Authorization: "Bearer tok123" });
  });

  it("omits Content-Type when there is no body", async () => {
    await req("DELETE", "/files/abc", "tok");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).not.toHaveProperty("Content-Type");
    expect(init).not.toHaveProperty("body");
  });

  it("serialises a body and sets Content-Type", async () => {
    await req("POST", "/files/unshare", "tok", { file_id: "f1" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({
      Authorization: "Bearer tok",
      "Content-Type": "application/json",
    });
    expect(init.body).toBe(JSON.stringify({ file_id: "f1" }));
  });

  it("sends an explicit null body rather than dropping it", async () => {
    await req("POST", "/files/share-expiry", "tok", { file_id: "f1", expires_at: null });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(JSON.stringify({ file_id: "f1", expires_at: null }));
  });

  it("sends no Authorization header for unauthenticated endpoints", async () => {
    await req("POST", "/auth/srp/challenge", null, { email: "a@b.c" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("returns the parsed JSON body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ deleted: true }));
    await expect(req("DELETE", "/files/x", "tok")).resolves.toEqual({ deleted: true });
  });

  it("throws the server's error message, with status and code attached", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "That name is taken", code: "NAME_CONFLICT" }, { status: 409 })
    );

    await expect(req("POST", "/folders", "tok", {})).rejects.toMatchObject({
      message: "That name is taken",
      status: 409,
      code: "NAME_CONFLICT",
    });
  });

  it("falls back to a generic message when the error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    await expect(req("GET", "/files", "tok")).rejects.toMatchObject({
      message: "Request failed (500)",
      status: 500,
    });
  });

  it("fires the unauthorized handler on 401", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "nope" }, { status: 401 }));

    await expect(req("GET", "/files", "tok")).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
