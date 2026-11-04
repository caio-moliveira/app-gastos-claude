import type { Metadata } from "next";
import Link from "next/link";
import { CategoryBarChart, TrendLineChart } from "@/components/finance/charts";
import { MonthPicker } from "@/components/finance/month-picker";
import { StatCard } from "@/components/finance/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccounts, getCategories, getLedger, getTopExpenses } from "@/lib/data/finance";
import { buildDashboard, formatPercentChange } from "@/lib/finance/dashboard";
import { currentMonth, formatDateBR, formatMonthLong, isMonth, monthEnd, monthStart } from "@/lib/finance/dates";
import { formatBRL } from "@/lib/finance/money";
import { getSpaceContext } from "@/lib/spaces";

export const metadata: Metadata = { title: "Painel" };

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<{ mes?: string | string[] }>;
}) {
  const { spaceId } = await params;
  const { mes } = await searchParams;
  const { space } = await getSpaceContext(spaceId);
  const month = typeof mes === "string" && isMonth(mes) ? mes : currentMonth();

  const [accounts, categories, ledger, top] = await Promise.all([
    getAccounts(space.id),
    getCategories(space.id),
    getLedger(space.id),
    getTopExpenses(space.id, monthStart(month), monthEnd(month), 5),
  ]);
  const d = buildDashboard(accounts, ledger, month);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const base = `/s/${space.id}`;

  const vs = (percent: number | null) => (
    <span data-testid="vs-previous">{formatPercentChange(percent)} vs. mês anterior</span>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{space.name}</h1>
          <p className="text-sm text-muted-foreground">Resumo de {formatMonthLong(month)}</p>
        </div>
        <MonthPicker month={month} hrefFor={(m) => `${base}?mes=${m}`} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Saldo total"
          cents={d.balance}
          testId="card-balance"
          footer={`em ${formatDateBR(d.balanceAsOf)} · contas ativas`}
        />
        <StatCard label="Receitas do mês" cents={d.income} tone="income" testId="card-income" footer={vs(d.vsPrevious.income.percent)} />
        <StatCard label="Despesas do mês" cents={d.expense} tone="expense" testId="card-expense" footer={vs(d.vsPrevious.expense.percent)} />
        <StatCard
          label="Resultado do mês"
          cents={d.result}
          tone={d.result >= 0 ? "income" : "expense"}
          testId="card-result"
          footer={vs(d.vsPrevious.result.percent)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoria</CardTitle>
            <CardDescription className="capitalize">{formatMonthLong(month)}</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={d.byCategory.map((c) => ({ name: categoryById.get(c.category_id)?.name ?? "Sem categoria", total: c.total }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Receitas × despesas</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendLineChart data={d.trend.map((t) => ({ label: t.label, income: t.income, expense: t.expense }))} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Maiores despesas do mês</CardTitle>
          </CardHeader>
          <CardContent>
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma despesa neste mês.</p>
            ) : (
              <ol className="divide-y" data-testid="top-expenses">
                {top.map((tx) => (
                  <li key={tx.id} className="flex items-center gap-3 py-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: categoryById.get(tx.category_id ?? "")?.color ?? "#64748b" }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tx.description}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDateBR(tx.date)} · {categoryById.get(tx.category_id ?? "")?.name ?? "—"} · {accountName.get(tx.account_id)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatBRL(tx.amount_cents)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Detalhe por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {d.byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem despesas neste mês.</p>
            ) : (
              <table className="w-full text-sm" data-testid="category-table">
                <caption className="sr-only">Gastos por categoria em {formatMonthLong(month)}</caption>
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 font-medium">Categoria</th>
                    <th className="py-1 text-right font-medium">Gasto</th>
                    <th className="py-1 text-right font-medium">% do mês</th>
                  </tr>
                </thead>
                <tbody>
                  {d.byCategory.map((c) => {
                    const cat = categoryById.get(c.category_id);
                    return (
                      <tr key={c.category_id} className="border-t">
                        <td className="py-1.5">
                          <span className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: cat?.color ?? "#64748b" }} aria-hidden />
                            {cat?.name ?? "Sem categoria"}
                          </span>
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{formatBRL(c.total)}</td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                          {d.expense > 0 ? `${Math.round((c.total / d.expense) * 100)} %` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Confira os lançamentos em{" "}
        <Link className="underline underline-offset-4" href={`${base}/transacoes?mes=${month}`}>
          Transações de {formatMonthLong(month)}
        </Link>
        .
      </p>
    </div>
  );
}
