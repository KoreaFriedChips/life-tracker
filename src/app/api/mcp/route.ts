import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getAgentDb } from "@/db/client";
import { createAgentMcpServer } from "@/lib/agentMcp";

/**
 * MCP endpoint (Streamable HTTP, stateless) that lets AI agents such as Claude Code and
 * Codex read and create to-dos. Authenticated by `Authorization: Bearer <AGENT_API_TOKEN>`
 * instead of the session cookie, so src/proxy.ts exempts this path.
 */
async function handle(req: Request): Promise<Response> {
  const db = await getAgentDb(req);
  if (!db) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  // Stateless: a fresh server + transport per request, since serverless instances don't share memory.
  const server = createAgentMcpServer(db);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
