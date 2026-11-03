import type { Metadata } from "next";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSpaceContext } from "@/lib/spaces";
import { ROLE_LABELS, isOwner } from "@/lib/validation/spaces";
import { DeleteSpaceForm, RenameSpaceForm } from "./settings-forms";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const { space } = await getSpaceContext(spaceId);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Configurações do espaço</h1>
      {isOwner(space.role) ? (
        <>
          <RenameSpaceForm spaceId={space.id} name={space.name} />
          <DeleteSpaceForm spaceId={space.id} name={space.name} />
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{space.name}</CardTitle>
            <CardDescription>
              Seu papel neste espaço é {ROLE_LABELS[space.role]}. Só o dono pode renomear ou excluir o espaço.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
