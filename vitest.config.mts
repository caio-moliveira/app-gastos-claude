import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` lança erro fora do bundler do Next; nos testes é um no-op.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Os testes de integração criam usuários reais no Supabase: rodar arquivos em série evita rate limit.
    fileParallelism: false,
  },
});
