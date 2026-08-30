import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Without this, a production crash only ever shows a minified stack trace
  // (e.g. "index-DoBjwDak.js:144:40371") that can't be mapped back to real
  // source without the exact matching build artifact — genuinely undebuggable
  // after the fact. The .map files are static assets served alongside the
  // bundle; they don't affect app behavior, just what devtools can show.
  build: { sourcemap: true },
});
