import { envStr, envNum } from "./env";
const EXTRACTOR_URL = envStr("EXTRACTOR_URL");
const EXTRACT_TIMEOUT_MS = envNum("EXTRACT_TIMEOUT_MS");

export class NoTextError extends Error {}

export class ExtractUnavailableError extends Error {}

export async function extractText(bytes: Buffer): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EXTRACT_TIMEOUT_MS);
  let res: Response;
  // Plaintext copy for the request body; zeroed once the request has been sent.
  const payload = new Uint8Array(bytes);
  try {
    res = await fetch(`${EXTRACTOR_URL}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: payload as unknown as BodyInit,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new ExtractUnavailableError((e as Error).message);
  } finally {
    clearTimeout(timer);
    payload.fill(0);
  }
  if (res.status === 415 || res.status === 400) throw new NoTextError();
  if (!res.ok) throw new ExtractUnavailableError(`extractor returned ${res.status}`);
  const body = (await res.json()) as { text?: string };
  const text = String(body.text || "").trim();
  if (!text) throw new NoTextError();
  return text;
}
