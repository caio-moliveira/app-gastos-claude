import type { Metadata } from "next";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSpaceContext } from "@/lib/spaces";
import { ROLE_LABELS, SPACE_TYPE_LABELS } from "@/lib/validation/spaces";

export const metadata: Metadata = { title: "Painel" };

export default async function DashboardPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const { space } = await getSpaceContext(spaceId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{space.name}</h1>
        <p className="text-sm text-muted-foreground">
          Espaço {SPACE_TYPE_LABELS[space.type].toLowerCase()} · seu papel: {ROLE_LABELS[space.role]}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo ao Cofre</CardTitle>
          <CardDescription>
            Use o seletor no topo para alternar entre seus espaços financeiros.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
