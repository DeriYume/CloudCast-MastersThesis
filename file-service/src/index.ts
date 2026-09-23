import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import helmet from "helmet";
import { router } from "./routes";
import { aiRouter } from "./airoutes";
import { startSweeper } from "./sweeper";
import * as cc from "./sodiumcrypto";
import { loadServerKey } from "./serverkey";
import { envNum } from "./env";

const app = express();
const PORT = envNum("PORT");

process.on("unhandledRejection", (reason) => {
  console.error("[file-service] unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[file-service] uncaughtException:", err);
});

app.use(helmet());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "file" }));

app.use("/", aiRouter);
app.use("/", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooBig ? 413 : 400)
      .json({ error: tooBig ? "File is too large" : `Upload error: ${err.message}` });
  }
  console.error("[file-service] unhandled error:", err);
  if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
});

async function start(): Promise<void> {
  await cc.ready();
  loadServerKey();
  app.listen(PORT, () => console.log(`file-service listening on ${PORT}`));
  startSweeper();
}

start().catch((e) => {
  console.error("[file-service] startup aborted:", e);
  process.exit(1);
});
