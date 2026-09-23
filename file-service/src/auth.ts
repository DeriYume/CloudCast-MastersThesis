import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "./db";

const JWT_SECRET = process.env.JWT_SECRET as string;
const INTERNAL_KEY = process.env.INTERNAL_KEY as string;

export interface AuthedRequest extends Request {
  userId?: string;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.header("x-internal-key") !== INTERNAL_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  let payload: { sub: string; jti?: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as typeof payload;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (payload.jti) {
    const session = await pool.query(
      "SELECT 1 FROM token_sessions WHERE jti = $1",
      [payload.jti]
    );
    if (!session.rowCount) return res.status(401).json({ error: "Session not found or logged out" });
  }

  req.userId = payload.sub;
  next();
}
