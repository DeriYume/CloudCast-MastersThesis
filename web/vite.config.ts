import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { fileURLToPath } from "url";

const sodiumCjs = fileURLToPath(
  new URL("./node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js", import.meta.url)
);

const randomHexShim = fileURLToPath(new URL("./src/shims/crypto-random-hex.cjs", import.meta.url));

export default defineConfig({

  plugins: [react(), nodePolyfills({ exclude: ["crypto", "vm"] })],
  resolve: {
    alias: {
      "libsodium-wrappers-sumo": sodiumCjs,
      "crypto-random-hex": randomHexShim,
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "https://localhost:8443",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
