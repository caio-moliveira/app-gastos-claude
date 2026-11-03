import type { NextConfig } from "next";

// Cache Components desligado: todas as telas dependem da sessão do usuário (cookies)
// e dos dados do espaço, então são dinâmicas por natureza. Ver docs/DECISIONS.md (ADR-004).
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
