import express, { Request, Response, NextFunction } from "express";

import https from "https";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { createProxyMiddleware } from "http-proxy-middleware";
import { readFileSync } from "fs";
import { envNum } from "./env";

const app = express();
const PORT = envNum("PORT");

process.on("unhandledRejection", (reason) => console.error("[gateway] unhandledRejection:", reason));
process.on("uncaughtException", (err) => console.error("[gateway] uncaughtException:", err));
const AUTH_URL = process.env.AUTH_URL as string;
const FILE_URL = process.env.FILE_URL as string;
const JWT_SECRET = process.env.JWT_SECRET as string;
const INTERNAL_KEY = process.env.INTERNAL_KEY as string;

app.use(helmet());

app.use(rateLimit({ windowMs: 60_000, limit: envNum("RATE_LIMIT_PER_MIN") }));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "gateway" }));

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function addInternalKey(req: Request, _res: Response, next: NextFunction) {
  req.headers["x-internal-key"] = INTERNAL_KEY;
  next();
}

app.use(
  "/auth",
  addInternalKey,
  createProxyMiddleware({
    target: AUTH_URL,
    changeOrigin: true,
    pathRewrite: { "^/auth": "" },
  })
);

app.use(
  "/files",
  requireAuth,
  addInternalKey,
  createProxyMiddleware({
    target: FILE_URL,
    changeOrigin: true,
    pathRewrite: { "^/files": "" },
  })
);

const tlsOptions = {
  key: readFileSync("/certs/server-key.pem"),
  cert: readFileSync("/certs/server.pem"),
};

https.createServer(tlsOptions, app).listen(PORT, "0.0.0.0", () =>
    console.log(`gateway on https://0.0.0.0:${PORT}`));
