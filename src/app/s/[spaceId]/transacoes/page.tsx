import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { TransactionFormDialog } from "@/components/finance/transaction-form-dialog";
import { TransactionList } from "@/components/finance/transaction-list";
import { NativeSelect } from "@/components/native-select";
import { StatCard } from "@/components/finance/stat-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TRANSACTIONS_PAGE_SIZE, getAccounts, getCategories, getLedger, getTransactionsPage } from "@/lib/data/finance";
import { addMonths, currentMonth, formatMonthLong, isMonth, monthEnd, monthStart } from "@/lib/finance/dates";
import { monthTotals } from "@/lib/finance/rules";
import { getSpaceContext } from "@/lib/spaces";
import { cn } from "@/lib/utils";
import { TX_TYPE_LABELS, TX_TYPES, type TransactionType } from "@/lib/validation/finance";
import { canEdit, uuidSchema } from "@/lib/validation/spaces";

export const metadata: Metadata = { title: "Transações" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { spaceId } = await params;
  const sp = await searchParams;
  const { space } = await getSpaceContext(spaceId);

  const month = isMonth(one(sp.mes)) ? (one(sp.mes) as string) : currentMonth();
  const accountId = uuidSchema.safeParse(one(sp.conta)).success ? one(sp.conta) : undefined;
  const categoryId = uuidSchema.safeParse(one(sp.categoria)).success ? one(sp.categoria) : undefined;
  const typeParam = one(sp.tipo);
  const type = (TX_TYPES as readonly string[]).includes(typeParam ?? "") ? (typeParam as TransactionType) : undefined;
  const search = (one(sp.q) ?? "").trim().slice(0, 100) || undefined;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(one(sp.pagina) ?? "1", 10) || 1));

  const [accounts, categories, monthLedger, { rows, total }] = await Promise.all([
    getAccounts(space.id),
    getCategories(space.id),
    getLedger(space.id, monthStart(month), monthEnd(month)),
    getTransactionsPage(
      space.id,
      { from: monthStart(month), to: monthEnd(month), accountId, categoryId, type, search },
      page,
    ),
  ]);
  const totals = monthTotals(monthLedger, month);
  const editable = canEdit(space.role);
  const pages = Math.max(1, Math.ceil(total / TRANSACTIONS_PAGE_SIZE));

  const base = `/s/${space.id}/transacoes`;
  const query = (overrides: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      mes: month,
      conta: accountId,
      categoria: categoryId,
      tipo: type,
      q: search,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    return `${base}?${qs.toString()}`;
  };

  // Página além do fim (link antigo ou exclusão do último item da última página).
  if (page > pages) redirect(query({ pagina: pages > 1 ? String(pages) : undefined }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Transações</h1>
        <div className="flex items-center gap-1">
          <Link href={query({ mes: addMonths(month, -1), pagina: undefined })} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Mês anterior">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-36 text-center text-sm font-medium capitalize">{formatMonthLong(month)}</span>
          <Link href={query({ mes: addMonths(month, 1), pagina: undefined })} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Próximo mês">
            <ChevronRight className="size-4" />
          </Link>
        </div>
        {editable ? (
          <div className="ml-auto">
            <TransactionFormDialog
              spaceId={space.id}
              accounts={accounts}
              categories={categories}
              trigger={
                <Button>
                  <Plus className="size-4" /> Nova transação
                </Button>
              }
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Receitas do mês" cents={totals.income} tone="income" testId="month-income" />
        <StatCard label="Despesas do mês" cents={totals.expense} tone="expense" testId="month-expense" />
        <StatCard label="Resultado do mês" cents={totals.result} tone={totals.result >= 0 ? "income" : "expense"} testId="month-result" />
      </div>

      <form method="get" action={base} className="grid grid-cols-2 gap-3 rounded-lg border p-3 md:grid-cols-6">
        <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
          <Label htmlFor="f-mes">Mês</Label>
          <Input id="f-mes" name="mes" type="month" defaultValue={month} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-conta">Conta</Label>
          <NativeSelect id="f-conta" name="conta" defaultValue={accountId ?? ""}>
            <option value="">Todas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-categoria">Categoria</Label>
          <NativeSelect id="f-categoria" name="categoria" defaultValue={categoryId ?? ""}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.kind === "income" ? "receita" : "despesa"})
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-tipo">Tipo</Label>
          <NativeSelect id="f-tipo" name="tipo" defaultValue={type ?? ""}>
            <option value="">Todos</option>
            {TX_TYPES.map((t) => (
              <option key={t} value={t}>
                {TX_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-q">Busca</Label>
          <Input id="f-q" name="q" defaultValue={search ?? ""} placeholder="Descrição" maxLength={100} />
        </div>
        <div className="col-span-2 flex items-end gap-2 md:col-span-1">
          <Button type="submit" variant="secondary" className="flex-1">
            Filtrar
          </Button>
          <Link href={`${base}?mes=${month}`} className={cn(buttonVariants({ variant: "ghost" }))}>
            Limpar
          </Link>
        </div>
      </form>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span data-testid="transaction-count">
          {total} {total === 1 ? "transação" : "transações"}
        </span>
        {pages > 1 ? (
          <span>
            Página {page} de {pages}
          </span>
        ) : null}
      </div>

      <TransactionList
        spaceId={space.id}
        rows={rows}
        accounts={accounts}
        categories={categories}
        canEdit={editable}
        emptyMessage={`Nenhuma transação em ${formatMonthLong(month)} com esses filtros.`}
      />

      {pages > 1 ? (
        <nav className="flex justify-between" aria-label="Paginação">
          {page > 1 ? (
            <Link href={query({ pagina: String(page - 1) })} className={buttonVariants({ variant: "outline" })}>
              Anterior
            </Link>
          ) : (
            <span />
          )}
          {page < pages ? (
            <Link href={query({ pagina: String(page + 1) })} className={buttonVariants({ variant: "outline" })}>
              Próxima
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
