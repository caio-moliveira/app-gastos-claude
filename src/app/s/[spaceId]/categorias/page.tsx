import type { Metadata } from "next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategories, getLedger } from "@/lib/data/finance";
import { getSpaceContext } from "@/lib/spaces";
import type { CategoryKind } from "@/lib/validation/finance";
import { canEdit } from "@/lib/validation/spaces";
import { deleteCategoryAction } from "../finance-actions";
import { CategoryFormDialog, MoveTargetSelect } from "./category-forms";

export const metadata: Metadata = { title: "Categorias" };

const KIND_TITLES: Record<CategoryKind, string> = { expense: "Despesas", income: "Receitas" };

export default async function CategoriesPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const { space } = await getSpaceContext(spaceId);
  const [categories, ledger] = await Promise.all([getCategories(space.id), getLedger(space.id)]);
  const usage = new Map<string, number>();
  for (const tx of ledger) if (tx.category_id) usage.set(tx.category_id, (usage.get(tx.category_id) ?? 0) + 1);
  const editable = canEdit(space.role);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {(["expense", "income"] as const).map((kind) => {
          const list = categories.filter((c) => c.kind === kind);
          return (
            <Card key={kind}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{KIND_TITLES[kind]}</CardTitle>
                {editable ? (
                  <CategoryFormDialog
                    spaceId={space.id}
                    defaultKind={kind}
                    trigger={
                      <Button size="sm" variant="outline">
                        <Plus className="size-4" /> Nova
                      </Button>
                    }
                  />
                ) : null}
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {list.map((category) => {
                    const count = usage.get(category.id) ?? 0;
                    const targets = list.filter((c) => c.id !== category.id).map((c) => ({ id: c.id, name: c.name }));
                    return (
                      <li key={category.id} className="flex items-center gap-3 py-2" data-testid="category-row">
                        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: category.color }} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {count} {count === 1 ? "transação" : "transações"}
                        </span>
                        {editable ? (
                          <div className="flex shrink-0 items-center">
                            <CategoryFormDialog
                              spaceId={space.id}
                              category={category}
                              kindLocked={count > 0}
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${category.name}`}>
                                  <Pencil className="size-4" />
                                </Button>
                              }
                            />
                            {count === 0 || targets.length > 0 ? (
                              <ConfirmAction
                                action={deleteCategoryAction}
                                fields={{ spaceId: space.id, id: category.id }}
                                title="Excluir categoria?"
                                description={
                                  count > 0
                                    ? `“${category.name}” tem ${count} ${count === 1 ? "transação" : "transações"}. Escolha para onde movê-las antes de excluir.`
                                    : `A categoria “${category.name}” será excluída.`
                                }
                                confirmLabel={count > 0 ? "Mover e excluir" : "Excluir"}
                                trigger={
                                  <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${category.name}`}>
                                    <Trash2 className="size-4" />
                                  </Button>
                                }
                              >
                                {count > 0 ? <MoveTargetSelect options={targets} /> : null}
                              </ConfirmAction>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                  {list.length === 0 ? <li className="py-2 text-sm text-muted-foreground">Nenhuma categoria.</li> : null}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
