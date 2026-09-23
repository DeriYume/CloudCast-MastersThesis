function missing(name: string): never {
  throw new Error(
    `[config] ${name} is not set. Every tunable is supplied by .env (see .env.example); ` +
    `there are no built-in defaults.`
  );
}

export function envStr(name: string): string {
  const v = process.env[name];
  return v !== undefined && v !== "" ? v : missing(name);
}

export function envNum(name: string): number {
  const raw = envStr(name);
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`[config] ${name}="${raw}" is not a number.`);
  return n;
}

export function envBool(name: string): boolean {
  const raw = envStr(name).toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`[config] ${name}="${raw}" must be exactly "true" or "false".`);
}
