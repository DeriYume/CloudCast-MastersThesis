import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

const randomHexShim = fileURLToPath(new URL("./src/shims/crypto-random-hex.cjs", import.meta.url));

const libsodiumCjs = fileURLToPath(
  new URL("./node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "crypto-random-hex": randomHexShim,
      "libsodium-wrappers-sumo": libsodiumCjs,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
