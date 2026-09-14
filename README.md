# Life Tracker

A personal life-tracking app for managing to-dos by category, keeping tabs on
people and when you last spoke with them, and logging knowledge (books,
articles, papers) with a graph view of how entries connect. Built with
Next.js (App Router), TypeScript, Tailwind, and SQLite via Drizzle ORM.

## Running the app

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Data

The SQLite database lives at `data/life.db`. It is created, migrated, and
seeded with default to-do categories automatically the first time the app
runs — no setup step required.

To back up your data, copy the `data/` folder.
# life-tracker

## AI agent access (Claude Code, Codex)

The app serves an [MCP](https://modelcontextprotocol.io) endpoint at `/api/mcp`
with three tools: `list_categories`, `list_todos`, and `create_todo`. Agents
authenticate with a bearer token instead of the login password.

1. Generate a token (`openssl rand -base64 32`) and set it as `AGENT_API_TOKEN`
   in Vercel (and `.env.local` for local dev). The endpoint rejects every request
   while it is unset.
2. Export the same token in your shell profile: `export LIFE_TRACKER_TOKEN=...`
3. Register the server with each agent:

```bash
# Claude Code (available in every project)
claude mcp add --transport http --scope user life-tracker https://<your-app>.vercel.app/api/mcp \
  --header "Authorization: Bearer ${LIFE_TRACKER_TOKEN}"
```

```toml
# Codex: ~/.codex/config.toml
[mcp_servers.life-tracker]
url = "https://<your-app>.vercel.app/api/mcp"
bearer_token_env_var = "LIFE_TRACKER_TOKEN"
```

To revoke access, change or remove `AGENT_API_TOKEN` and redeploy.
