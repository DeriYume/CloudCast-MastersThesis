import { genericHttpMessage, type ApiError } from "../api/http";

export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export function httpStatus(e: unknown): number | null {
  const status = (e as ApiError | undefined)?.status;
  return typeof status === "number" ? status : null;
}

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /networkerror when attempting to fetch/i,
  /^load failed$/i,
  /network request failed/i,
  /err_(internet_disconnected|connection_refused|connection_reset|name_not_resolved)/i,
];

function networkMessage(e: unknown): string | null {
  if (e instanceof DOMException || (e as { name?: string })?.name) {
    const name = (e as { name?: string }).name;
    if (name === "AbortError") return "That took too long. Try again.";
    if (name === "TimeoutError") return "The server took too long to respond. Try again.";
  }
  const message = (e as { message?: unknown })?.message;
  if (typeof message !== "string") return null;
  if (e instanceof TypeError || NETWORK_PATTERNS.some((p) => p.test(message))) {
    if (NETWORK_PATTERNS.some((p) => p.test(message))) {
      return "Can't reach CloudCast. Check your internet connection and try again.";
    }
  }
  return null;
}

function httpStatusMessage(status: number): string | null {
  if (status >= 500 && status <= 599) return "The server ran into a problem. Please try again shortly.";
  if (status === 408) return "That took too long. Try again.";
  if (status === 429) return "Too many attempts. Wait a moment and try again.";
  return null;
}

export function friendlyError(e: unknown, fallback: string): string {
  const status = httpStatus(e);
  if (status !== null) {
    const message = (e as ApiError).message;
    if (message && message !== genericHttpMessage(status)) return message;
    return httpStatusMessage(status) ?? fallback;
  }

  const network = networkMessage(e);
  if (network) return network;

  if (e instanceof UserError && e.message) return e.message;

  return fallback;
}
