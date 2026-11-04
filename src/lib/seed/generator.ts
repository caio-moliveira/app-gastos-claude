/**
 * Gerador determinístico das transações do seed (PRD §9). Função pura: dado o espaço,
 * o mês e as contas/categorias, devolve sempre as mesmas transações (semente fixa por mês),
 * então os números das perguntas de referência (§7.4) são reproduzíveis.
 */
import { createHash } from "node:crypto";
import { monthEnd } from "@/lib/finance/dates";

export type SeedSpaceKey = "pessoal" | "casa";

export type SeedTx = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount_cents: number;
  date: string;
  description: string;
  account: string; // chave lógica da conta
  to_account?: string;
  category?: string; // nome da categoria
};

/** Maior número de transações que um mês pode ter (usado para limpar ids obsoletos do seed). */
export const MAX_TX_PER_MONTH = 60;

/** UUID estável derivado de uma chave (formato v4/variante RFC 4122, bits fixos). */
export function stableUuid(key: string): string {
  const h = createHash("sha256").update(`cofre-claude:${key}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** PRNG mulberry32 com semente derivada de uma string. */
export function rng(seed: string) {
  let a = parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    /** Valor em centavos entre min e max reais, arredondado a 10 centavos. */
    money: (min: number, max: number) => Math.round((min + next() * (max - min)) * 10) * 10,
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  };
}

const MERCADOS = ["Supermercado Bom Preço", "Mercado da Vila", "Atacarejo Central", "Hortifruti Feira Livre", "Mercadinho São José"];
const RESTAURANTES = ["Restaurante Sabor Caseiro", "Padaria Pão Quente", "Lanchonete do Bairro", "Pizzaria Forno a Lenha", "Delivery Marmita Fit", "Cafeteria Grão Dourado"];
const TRANSPORTE = ["Posto Avenida", "Posto Centro", "Corrida por aplicativo", "Recarga bilhete único", "Estacionamento Centro"];
const SAUDE = ["Farmácia Popular", "Drogaria Saúde Total", "Consulta clínica geral", "Laboratório Vida"];
const LAZER = ["Cinema Shopping", "Bar do Zé", "Show no Teatro Municipal", "Parque Aquático", "Livraria Leitura Boa"];
const OUTROS = ["Presente aniversário", "Papelaria Central", "Lavanderia Express", "Chaveiro 24h"];

function day(month: string, d: number): string {
  const last = Number(monthEnd(month).slice(8));
  return `${month}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/**
 * Transações de um espaço em um mês. `cardBillPrev` é o total gasto no cartão no mês anterior
 * (vira a transferência de pagamento da fatura). Retorna também o gasto no cartão deste mês.
 */
export function generateMonth(space: SeedSpaceKey, month: string, cardBillPrev: number): { txs: SeedTx[]; cardSpent: number } {
  const r = rng(`${space}:${month}`);
  const txs: SeedTx[] = [];
  const last = Number(monthEnd(month).slice(8));
  let cardSpent = 0;
  let seq = 0;
  const add = (tx: Omit<SeedTx, "id">) => {
    txs.push({ ...tx, id: stableUuid(`${space}:${month}:${seq++}`) });
    if (tx.type === "expense" && tx.account === "card") cardSpent += tx.amount_cents;
  };
  const anyDay = () => day(month, r.int(1, last));

  if (space === "casa") {
    add({ type: "income", amount_cents: r.money(7200, 8600), date: day(month, 5), description: "Salário Bruno", account: "checking", category: "Salário" });
    if (r.chance(0.4)) add({ type: "income", amount_cents: r.money(600, 1800), date: anyDay(), description: "Projeto freelance", account: "checking", category: "Freelance" });
    add({ type: "expense", amount_cents: 235_000, date: day(month, 10), description: "Aluguel apartamento", account: "checking", category: "Moradia" });
    add({ type: "expense", amount_cents: 48_000, date: day(month, 12), description: "Condomínio", account: "checking", category: "Moradia" });
    add({ type: "expense", amount_cents: r.money(140, 260), date: day(month, 18), description: "Conta de luz", account: "checking", category: "Moradia" });
    add({ type: "expense", amount_cents: 11_990, date: day(month, 20), description: "Internet fibra", account: "checking", category: "Assinaturas" });
    add({ type: "expense", amount_cents: 5_590, date: day(month, 15), description: "Streaming de vídeo", account: "card", category: "Assinaturas" });
    add({ type: "expense", amount_cents: 3_490, date: day(month, 25), description: "Streaming de música", account: "card", category: "Assinaturas" });
    // Compras já no começo do mês (o mês atual do seed tem poucos dias).
    add({ type: "expense", amount_cents: r.money(180, 420), date: day(month, 2), description: r.pick(MERCADOS), account: "card", category: "Mercado" });
    for (let i = r.int(5, 8); i > 0; i--)
      add({ type: "expense", amount_cents: r.money(80, 450), date: anyDay(), description: r.pick(MERCADOS), account: r.chance(0.6) ? "card" : "checking", category: "Mercado" });
    add({ type: "expense", amount_cents: r.money(35, 120), date: day(month, 1), description: r.pick(RESTAURANTES), account: "card", category: "Alimentação" });
    for (let i = r.int(5, 9); i > 0; i--)
      add({ type: "expense", amount_cents: r.money(35, 180), date: anyDay(), description: r.pick(RESTAURANTES), account: "card", category: "Alimentação" });
    for (let i = r.int(4, 7); i > 0; i--) {
      const d = r.pick(TRANSPORTE);
      const amount = d.startsWith("Posto") ? r.money(150, 280) : r.money(18, 60);
      add({ type: "expense", amount_cents: amount, date: anyDay(), description: d, account: d.startsWith("Posto") ? "card" : "wallet", category: "Transporte" });
    }
    for (let i = r.int(1, 3); i > 0; i--)
      add({ type: "expense", amount_cents: r.money(25, 180), date: anyDay(), description: r.pick(SAUDE.slice(0, 2)), account: "card", category: "Saúde" });
    if (r.chance(0.35)) add({ type: "expense", amount_cents: r.money(200, 320), date: anyDay(), description: "Consulta clínica geral", account: "checking", category: "Saúde" });
    for (let i = r.int(2, 4); i > 0; i--)
      add({ type: "expense", amount_cents: r.money(40, 220), date: anyDay(), description: r.pick(LAZER), account: "card", category: "Lazer" });
    if (r.chance(0.3)) add({ type: "expense", amount_cents: r.money(90, 350), date: anyDay(), description: "Material escolar", account: "checking", category: "Educação" });
    for (let i = r.int(1, 2); i > 0; i--)
      add({ type: "expense", amount_cents: r.money(30, 150), date: anyDay(), description: r.pick(OUTROS), account: "wallet", category: "Outros" });
    // Transferências (≥ 2 por mês).
    add({ type: "transfer", amount_cents: r.money(200, 300), date: day(month, 3), description: "Saque para a carteira", account: "checking", to_account: "wallet" });
    add({ type: "transfer", amount_cents: r.money(500, 1000), date: day(month, 6), description: "Reserva na poupança", account: "checking", to_account: "savings" });
    if (cardBillPrev > 0)
      add({ type: "transfer", amount_cents: cardBillPrev, date: day(month, 8), description: "Pagamento da fatura do cartão", account: "checking", to_account: "card" });
  } else {
    add({ type: "income", amount_cents: r.money(5400, 6200), date: day(month, 5), description: "Salário Ana", account: "checking", category: "Salário" });
    if (r.chance(0.3)) add({ type: "income", amount_cents: r.money(400, 1500), date: anyDay(), description: "Trabalho freelance", account: "checking", category: "Freelance" });
    add({ type: "expense", amount_cents: 32_000, date: day(month, 8), description: "Curso de inglês", account: "checking", category: "Educação" });
    add({ type: "expense", amount_cents: 9_990, date: day(month, 15), description: "Academia", account: "checking", category: "Saúde" });
    add({ type: "expense", amount_cents: 3_990, date: day(month, 22), description: "Streaming de vídeo", account: "card", category: "Assinaturas" });
    add({ type: "expense", amount_cents: r.money(25, 60), date: day(month, 1), description: r.pick(RESTAURANTES), account: "card", category: "Alimentação" });
    add({ type: "expense", amount_cents: r.money(18, 45), date: day(month, 2), description: "Corrida por aplicativo", account: "card", category: "Transporte" });
    for (let i = r.int(4, 6); i > 0; i--)
      add({ type: "expense", amount_cents: r.money(80, 260), date: anyDay(), description: r.pick(MERCADOS), account: "card", category: "Mercado" });
    for (let i = r.int(8, 12); i > 0; i--)
      add({ type: "expense", amount_cents: r.money(25, 120), date: anyDay(), description: r.pick(RESTAURANTES), account: r.chance(0.7) ? "card" : "wallet", category: "Alimentação" });
    for (let i = r.int(5, 8); i > 0; i--)
      add({ type: "expense", amount_cents: r.money(15, 55), date: anyDay(), description: r.pick(TRANSPORTE.slice(2)), account: "card", category: "Transporte" });
    for (let i = r.int(2, 5); i > 0; i--)
      add({ type: "expense", amount_cents: r.money(40, 200), date: anyDay(), description: r.pick(LAZER), account: "card", category: "Lazer" });
    for (let i = r.int(0, 2); i > 0; i--)
      add({ type: "expense", amount_cents: r.money(20, 150), date: anyDay(), description: r.pick(SAUDE.slice(0, 2)), account: "wallet", category: "Saúde" });
    for (let i = r.int(1, 2); i > 0; i--)
      add({ type: "expense", amount_cents: r.money(30, 120), date: anyDay(), description: r.pick(OUTROS), account: "wallet", category: "Outros" });
    add({ type: "transfer", amount_cents: r.money(150, 250), date: day(month, 2), description: "Saque para a carteira", account: "checking", to_account: "wallet" });
    if (cardBillPrev > 0)
      add({ type: "transfer", amount_cents: cardBillPrev, date: day(month, 10), description: "Pagamento da fatura do cartão", account: "checking", to_account: "card" });
    else
      add({ type: "transfer", amount_cents: r.money(300, 600), date: day(month, 10), description: "Reserva de emergência", account: "checking", to_account: "wallet" });
  }
  return { txs, cardSpent };
}
