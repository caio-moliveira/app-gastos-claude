"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, type Role } from "@/lib/validation/spaces";

type SpaceOption = { id: string; name: string; role: Role };

export function SpaceSwitcher({ current, spaces }: { current: SpaceOption; spaces: SpaceOption[] }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="max-w-[11rem] justify-between gap-2 sm:max-w-[16rem]" aria-label="Trocar de espaço" />
        }
      >
        <span className="truncate" data-testid="current-space">
          {current.name}
        </span>
        <ChevronsUpDown className="size-4 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Seus espaços</DropdownMenuLabel>
          {spaces.map((space) => (
            <DropdownMenuItem key={space.id} onClick={() => router.push(`/s/${space.id}`)}>
              <span className="flex-1 truncate">{space.name}</span>
              <span className="text-xs text-muted-foreground">{ROLE_LABELS[space.role]}</span>
              {space.id === current.id ? <Check className="size-4" aria-hidden /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(`/s/${current.id}/espacos/novo`)}>
          <Plus className="size-4" aria-hidden />
          Novo espaço
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
