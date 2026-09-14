import { createHash, timingSafeEqual } from "node:crypto";

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/**
 * True if `req` carries `Authorization: Bearer <AGENT_API_TOKEN>`.
 * Always false when AGENT_API_TOKEN is unset, so agent access is off by default.
 */
export function verifyAgentToken(req: Request): boolean {
  const expected = process.env.AGENT_API_TOKEN?.trim();
  if (!expected) return false;

  const match = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  // Hashing both sides gives equal-length buffers, so the comparison is constant-time.
  return timingSafeEqual(sha256(match[1].trim()), sha256(expected));
}
