import type { Metadata } from "next";
import { getSpaceContext } from "@/lib/spaces";
import { CreateSpaceForm } from "./create-space-form";

export const metadata: Metadata = { title: "Novo espaço" };

export default async function NewSpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  await getSpaceContext(spaceId);
  return (
    <div className="mx-auto w-full max-w-md">
      <CreateSpaceForm />
    </div>
  );
}
