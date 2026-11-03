import Link from "next/link";
import { Plus, Vault } from "lucide-react";
import { MainNav, type NavItem } from "@/components/app-shell/main-nav";
import { SpaceSwitcher } from "@/components/app-shell/space-switcher";
import { UserMenu } from "@/components/app-shell/user-menu";
import { TransactionFormDialog } from "@/components/finance/transaction-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAccounts, getCategories } from "@/lib/data/finance";
import { getSpaceContext } from "@/lib/spaces";
import { ROLE_LABELS, canEdit } from "@/lib/validation/spaces";

export default async function SpaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const { space, spaces, email } = await getSpaceContext(spaceId);
  const base = `/s/${space.id}`;
  const editable = canEdit(space.role);
  const [accounts, categories] = editable
    ? await Promise.all([getAccounts(space.id), getCategories(space.id)])
    : [[], []];

  const nav: NavItem[] = [
    { href: base, label: "Painel", exact: true },
    { href: `${base}/transacoes`, label: "Transações" },
    { href: `${base}/contas`, label: "Contas" },
    { href: `${base}/categorias`, label: "Categorias" },
    { href: `${base}/configuracoes`, label: "Configurações" },
  ];

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-2">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-1.5 font-semibold" aria-label="Cofre — início">
              <Vault className="size-5 text-primary" aria-hidden />
              <span className="hidden sm:inline">Cofre</span>
            </Link>
            <SpaceSwitcher current={space} spaces={spaces} />
            <Badge variant="secondary" className="hidden sm:inline-flex" data-testid="current-role">
              {ROLE_LABELS[space.role]}
            </Badge>
            <div className="ml-auto flex items-center gap-1">
              {editable ? (
                <TransactionFormDialog
                  spaceId={space.id}
                  accounts={accounts}
                  categories={categories}
                  trigger={
                    <Button size="sm" aria-label="Nova transação" data-testid="quick-new-transaction">
                      <Plus className="size-4" />
                      <span className="hidden sm:inline">Nova transação</span>
                    </Button>
                  }
                />
              ) : null}
              <UserMenu email={email} />
            </div>
          </div>
          <MainNav items={nav} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
