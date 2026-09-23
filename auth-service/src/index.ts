import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { router } from "./routes";
import { assertIndexSecrets } from "./indexcrypto";
import * as cc from "./sodiumcrypto";
import { envNum } from "./env";

const app = express();
const PORT = envNum("PORT");
const INTERNAL_KEY = process.env.INTERNAL_KEY as string;

process.on("unhandledRejection", (reason) => {
  console.error("[auth-service] unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[auth-service] uncaughtException:", err);
});

app.use(helmet());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "auth" }));

app.use((req, res, next) => {
  if (req.header("x-internal-key") !== INTERNAL_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

app.use(rateLimit({ windowMs: 60_000, limit: 20 }));

app.use("/", router);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[auth-service] unhandled error:", err);
  if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
});

async function start(): Promise<void> {
  assertIndexSecrets();
  await cc.ready();
  app.listen(PORT, () => console.log(`auth-service listening on ${PORT}`));
}

start().catch((e) => {
  console.error("auth-service failed to start:", e);
  process.exit(1);
});
