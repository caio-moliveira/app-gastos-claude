import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { addMonths, formatMonthLong } from "@/lib/finance/dates";

/** Seletor de mês por links (?mes=AAAA-MM), funciona sem JavaScript. */
export function MonthPicker({ month, hrefFor }: { month: string; hrefFor: (month: string) => string }) {
  return (
    <div className="flex items-center gap-1" data-testid="month-picker">
      <Link href={hrefFor(addMonths(month, -1))} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Mês anterior">
        <ChevronLeft className="size-4" />
      </Link>
      <span className="min-w-36 text-center text-sm font-medium capitalize" data-testid="selected-month">
        {formatMonthLong(month)}
      </span>
      <Link href={hrefFor(addMonths(month, 1))} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Próximo mês">
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}
