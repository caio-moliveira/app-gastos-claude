import type { Metadata } from "next";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { StatCard } from "@/components/finance/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAccounts, getLedger } from "@/lib/data/finance";
import { todayISO } from "@/lib/finance/dates";
import { formatBRL } from "@/lib/finance/money";
import { accountBalances, spaceTotalBalance } from "@/lib/finance/rules";
import { getSpaceContext } from "@/lib/spaces";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE_LABELS } from "@/lib/validation/finance";
import { canEdit } from "@/lib/validation/spaces";
import { deleteAccountAction, setAccountArchivedAction } from "../finance-actions";
import { AccountFormDialog } from "./account-forms";

export const metadata: Metadata = { title: "Contas" };

export default async function AccountsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const { space } = await getSpaceContext(spaceId);
  const today = todayISO();
  const [accounts, ledger] = await Promise.all([getAccounts(space.id), getLedger(space.id)]);
  const balances = accountBalances(accounts, ledger, today);
  const total = spaceTotalBalance(accounts, ledger, today);
  const editable = canEdit(space.role);
  const usedAccounts = new Set(ledger.flatMap((t) => [t.account_id, t.transfer_to_account_id ?? ""]));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Contas</h1>
        {editable ? (
          <div className="ml-auto">
            <AccountFormDialog
              spaceId={space.id}
              trigger={
                <Button>
                  <Plus className="size-4" /> Nova conta
                </Button>
              }
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Saldo total (contas ativas)" cents={total} testId="space-total-balance" />
      </div>

      <ul className="divide-y rounded-lg border">
        {accounts.map((account) => {
          const balance = balances.get(account.id) ?? 0;
          return (
            <li key={account.id} className={cn("flex items-center gap-3 px-3 py-3", account.archived && "opacity-60")} data-testid="account-row">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  <span className="truncate" data-testid="account-name">
                    {account.name}
                  </span>
                  {account.archived ? <Badge variant="outline">Arquivada</Badge> : null}
                </p>
                <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.type]}</p>
              </div>
              <span
                className={cn("shrink-0 text-sm font-semibold tabular-nums", balance < 0 && "text-rose-600 dark:text-rose-400")}
                data-testid="account-balance"
              >
                {formatBRL(balance)}
              </span>
              {editable ? (
                <div className="flex shrink-0 items-center">
                  <AccountFormDialog
                    spaceId={space.id}
                    account={account}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${account.name}`}>
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <ConfirmAction
                    action={setAccountArchivedAction}
                    fields={{ spaceId: space.id, id: account.id, archived: String(!account.archived) }}
                    title={account.archived ? "Reativar conta?" : "Arquivar conta?"}
                    description={
                      account.archived
                        ? "A conta volta a aparecer nos formulários e no saldo total."
                        : "A conta some dos formulários e do saldo total, mas o histórico é mantido."
                    }
                    confirmLabel={account.archived ? "Reativar" : "Arquivar"}
                    destructive={false}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`${account.archived ? "Reativar" : "Arquivar"} ${account.name}`}>
                        {account.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                      </Button>
                    }
                  />
                  {!usedAccounts.has(account.id) ? (
                    <ConfirmAction
                      action={deleteAccountAction}
                      fields={{ spaceId: space.id, id: account.id }}
                      title="Excluir conta?"
                      description={`A conta “${account.name}” não tem transações e será excluída.`}
                      confirmLabel="Excluir"
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${account.name}`}>
                          <Trash2 className="size-4" />
                        </Button>
                      }
                    />
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {editable ? (
        <p className="text-xs text-muted-foreground">Contas com transações não podem ser excluídas — arquive-as.</p>
      ) : null}
    </div>
  );
}
