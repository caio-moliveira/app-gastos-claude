"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/finance/money";

// Paleta validada (skill dataviz): slot 1 azul, slot 2 laranja; texto sempre em tokens de texto.
const SERIES = { income: "var(--chart-series-1)", expense: "var(--chart-series-2)" } as const;

function compactBRL(cents: number): string {
  const reais = cents / 100;
  if (Math.abs(reais) >= 1000) return `R$ ${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(reais).toLocaleString("pt-BR")}`;
}

type TooltipPayload = { name?: string; value?: number; color?: string; payload?: Record<string, unknown> };

function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {label ? <p className="mb-1 font-medium">{label}</p> : null}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums">{formatBRL(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

export type CategoryDatum = { name: string; total: number };

/** Gasto por categoria no mês: uma série (sem legenda), barras horizontais ordenadas. */
export function CategoryBarChart({ data }: { data: CategoryDatum[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Sem despesas neste mês.</p>;
  }
  const height = Math.max(160, data.length * 36 + 24);
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Gastos por categoria no mês">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
          <XAxis type="number" tickFormatter={compactBRL} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={92}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
          <Bar dataKey="total" name="Gasto" fill={SERIES.income} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type TrendDatum = { label: string; income: number; expense: number };

/** Receitas × despesas nos últimos 6 meses: duas séries, legenda sempre presente. */
export function TrendLineChart({ data }: { data: TrendDatum[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ backgroundColor: SERIES.income }} /> Receitas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ backgroundColor: SERIES.expense }} /> Despesas
        </span>
      </div>
      <div className="h-56 w-full" role="img" aria-label="Receitas e despesas nos últimos 6 meses">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={compactBRL} width={64} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<MoneyTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} />
            <Line type="monotone" dataKey="income" name="Receitas" stroke={SERIES.income} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="expense" name="Despesas" stroke={SERIES.expense} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
