import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      input: {
        "rewrite-llm": resolvePath("./src/index.ts"),
        "test-sites/index": resolvePath("./test-sites/index.html"),
        "test-sites/site-a/index": resolvePath("./test-sites/site-a/index.html"),
        "test-sites/site-b/index": resolvePath("./test-sites/site-b/index.html"),
        "test-sites/site-c/index": resolvePath("./test-sites/site-c/index.html")
      },
      output: {
        entryFileNames: (chunk) => {
          return chunk.name === "rewrite-llm" ? "rewrite-llm.js" : "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  },
  worker: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
    fs: {
      strict: true
    }
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: false
  }
});
