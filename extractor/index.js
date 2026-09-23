const express = require("express");
const officeParser = require("officeparser");

function envNum(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    throw new Error(`[config] ${name} is not set. See .env.example; there are no built-in defaults.`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`[config] ${name}="${raw}" is not a number.`);
  return n;
}

const PORT = envNum("PORT");
const MAX_BYTES = envNum("EXTRACT_MAX_MB") * 1024 * 1024;
const MAX_CHARS = envNum("EXTRACT_MAX_CHARS");

const app = express();

app.use(express.raw({ type: "*/*", limit: MAX_BYTES }));

function collectText(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, out));
    return out;
  }
  if (node.type === "paragraph" && node.text) out.push(node.text);
  if (node.children) collectText(node.children, out);
  return out;
}

function extractText(ast) {
  const notes = [];
  for (const node of ast.content || []) {
    if (node && node.notes) collectText(node.notes, notes);
  }
  return [ast.toText(), ...notes].join("\n");
}

app.get("/health", (_req, res) => res.json({ status: "ok", service: "extractor" }));

app.post("/extract", async (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    return res.status(400).json({ error: "empty body" });
  }
  try {

    const ast = await officeParser.parseOffice(buf);
    const raw = extractText(ast);
    const text = String(raw || "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
    if (!text) return res.status(415).json({ error: "no extractable text" });
    return res.json({ text });
  } catch (e) {

    return res.status(415).json({ error: "could not extract text" });
  } finally {
    // Wipe the received plaintext bytes; parsing happens fully in memory.
    buf.fill(0);
  }
});

app.listen(PORT, () => console.log(`extractor listening on ${PORT}`));
