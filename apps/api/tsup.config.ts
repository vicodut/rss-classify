import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Workspace packages (@rss-agg/contract, @rss-agg/db) ship raw
  // TypeScript with no dist/ of their own — plain `tsc` alone produces a
  // dist/main.js that still imports their unbuildable .ts source, which
  // Node can't execute. Force-bundling just these two inlines that source
  // into our own output; everything else in node_modules stays external
  // (tsup's default for a Node platform build), which matters for
  // packages with native bindings like onnxruntime-node.
  noExternal: ["@rss-agg/contract", "@rss-agg/db"],
  // tsup auto-externalizes packages listed in *this* package's own
  // dependencies, but @rss-agg/db pulls in `ws` (for supabase-js's realtime
  // websocket client) as its own transitive dependency, invisible to that
  // heuristic — so it got bundled too and broke (its CJS code does a
  // dynamic `require()` that doesn't survive ESM bundling). Force it
  // external explicitly; it's a real node_modules package at runtime
  // either way via the workspace install.
  external: ["ws"],
});
