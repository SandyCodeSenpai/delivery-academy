import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath, URL } from "node:url";

// SINGLE=1 bun run build  -> one self-contained dist/index.html (used for the published artifact)
const single = process.env.SINGLE === "1";
export default defineConfig({
  base: "./",
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 5180, strictPort: true },
  build: { target: "es2020", chunkSizeWarningLimit: 4000 },
});
