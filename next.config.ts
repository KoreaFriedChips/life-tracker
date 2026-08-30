import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
  // migrate() (src/db/client.ts) reads drizzle/meta/_journal.json + SQL files at
  // runtime via a runtime-computed fs path, which output file tracing can't detect
  // statically. Force-include the migrations folder in every server route's bundle.
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/output (outputFileTracingIncludes)
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**"],
  },
};

export default nextConfig;
