import { config } from "dotenv";

// Scripts locais leem .env.local primeiro e depois .env (o primeiro valor definido vence).
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Variável de ambiente ausente: ${name}. Veja .env.example.`);
    process.exit(1);
  }
  return value;
}
