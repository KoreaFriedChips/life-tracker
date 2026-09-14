import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyAgentToken } from "@/lib/agentAuth";

function request(authorization?: string): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyAgentToken", () => {
  it("rejects every request when AGENT_API_TOKEN is unset", () => {
    vi.stubEnv("AGENT_API_TOKEN", "");
    expect(verifyAgentToken(request("Bearer "))).toBe(false);
    expect(verifyAgentToken(request("Bearer anything"))).toBe(false);
  });

  it("rejects a missing header, a non-bearer scheme, and a wrong token", () => {
    vi.stubEnv("AGENT_API_TOKEN", "s3cret");
    expect(verifyAgentToken(request())).toBe(false);
    expect(verifyAgentToken(request("Basic s3cret"))).toBe(false);
    expect(verifyAgentToken(request("Bearer wrong"))).toBe(false);
    expect(verifyAgentToken(request("Bearer s3cret-but-longer"))).toBe(false);
  });

  it("accepts the configured bearer token", () => {
    vi.stubEnv("AGENT_API_TOKEN", "s3cret");
    expect(verifyAgentToken(request("Bearer s3cret"))).toBe(true);
    expect(verifyAgentToken(request("bearer s3cret"))).toBe(true);
  });
});
