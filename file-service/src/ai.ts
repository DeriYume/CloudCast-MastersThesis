import { envStr, envNum, envBool } from "./env";
const OLLAMA_URL = envStr("OLLAMA_URL");
const TEXT_MODEL = envStr("AI_TEXT_MODEL");

const VISION_MODEL = envStr("AI_VISION_MODEL");
const AI_TIMEOUT_MS = envNum("AI_TIMEOUT_MS");

export function aiEnabled(): boolean {
  return envBool("AI_ENABLED");
}

export class AiUnavailableError extends Error {}

export class AiEmptyResultError extends Error {}

async function generate(model: string, prompt: string, images?: string[]): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        images,
        stream: false,
        options: { temperature: 0.2, num_predict: 220 },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new AiUnavailableError(`model HTTP ${res.status}`);
    const data: any = await res.json();
    const out = data && typeof data.response === "string" ? data.response.trim() : "";
    if (!out) throw new AiEmptyResultError("model returned no text");
    return out;
  } catch (e: any) {
    if (e instanceof AiUnavailableError || e instanceof AiEmptyResultError) throw e;
    throw new AiUnavailableError(
      e?.name === "AbortError" ? "model timed out" : `model unreachable: ${e?.message || e}`
    );
  } finally {
    clearTimeout(timer);
  }
}

const TEXT_PROMPT =
  "Summarise the following file content in 2-3 plain, factual sentences. " +
  "No preamble, no markdown.\n\nCONTENT:\n";
const IMAGE_PROMPT =
  "Describe this image in 2-3 concise, factual sentences. " +
  "Quote any legible text only if some is present; never state that text is absent. " +
  "No preamble.";

export async function analyzeText(text: string): Promise<{ summary: string; model: string }> {
  return { summary: await generate(TEXT_MODEL, TEXT_PROMPT + text), model: TEXT_MODEL };
}

export async function analyzeImage(base64: string): Promise<{ summary: string; model: string }> {
  return { summary: await generate(VISION_MODEL, IMAGE_PROMPT, [base64]), model: VISION_MODEL };
}

const IMAGE_CATEGORIES = ["Screenshots", "Photos", "Receipts", "Documents", "Diagrams", "Other"];
const TEXT_CATEGORIES = ["Code", "Documents", "Data", "Notes", "Other"];

function pickCategory(raw: string, allowed: string[]): string {
  const low = raw.toLowerCase();
  for (const c of allowed) if (low.includes(c.toLowerCase())) return c;
  return allowed[allowed.length - 1];
}

export async function classifyImage(base64: string): Promise<string> {
  const prompt =
    "Classify this image into EXACTLY ONE of these categories: " +
    IMAGE_CATEGORIES.join(", ") +
    ". Reply with only the single category word, nothing else.";
  return pickCategory(await generate(VISION_MODEL, prompt, [base64]), IMAGE_CATEGORIES);
}

export async function classifyText(text: string): Promise<string> {
  const prompt =
    "Classify the following file content into EXACTLY ONE of these categories: " +
    TEXT_CATEGORIES.join(", ") +
    ". Reply with only the single category word, nothing else.\n\nCONTENT:\n" +
    text;
  return pickCategory(await generate(TEXT_MODEL, prompt), TEXT_CATEGORIES);
}

function cleanFolderName(raw: string): string {
  const first = String(raw || "").split("\n")[0];
  const cleaned = first.replace(/["'`*_.:;!?()\[\]{}]/g, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, 3).join(" ");
  return words.slice(0, 40) || "Documents";
}

export async function suggestFolderName(text: string): Promise<string> {
  const prompt =
    "Suggest a short, general folder name (1 to 3 words, Title Case) to file a document with the " +
    "content below. Prefer a broad, reusable category a person would actually name a folder - e.g. " +
    "Invoices, Recipes, Travel, Contracts, Notes. Reply with ONLY the folder name, no quotes or " +
    "punctuation.\n\nCONTENT:\n" +
    text.slice(0, 4000);
  return cleanFolderName(await generate(TEXT_MODEL, prompt));
}

const EMBED_MODEL = envStr("AI_EMBED_MODEL");

export function semanticEnabled(): boolean {
  return envBool("AI_SEMANTIC_ENABLED");
}

export async function embed(text: string, kind: "document" | "query" = "document"): Promise<number[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);

  const prompt = /nomic/i.test(EMBED_MODEL)
    ? `${kind === "query" ? "search_query" : "search_document"}: ${text}`
    : text;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, prompt }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new AiUnavailableError(`embed HTTP ${res.status}`);
    const data: any = await res.json();
    const v = data && data.embedding;
    if (!Array.isArray(v) || v.length === 0) throw new AiUnavailableError("empty embedding");
    return v as number[];
  } catch (e: any) {
    if (e instanceof AiUnavailableError) throw e;
    throw new AiUnavailableError(
      e?.name === "AbortError" ? "embed timed out" : `embed unreachable: ${e?.message || e}`
    );
  } finally {
    clearTimeout(timer);
  }
}
