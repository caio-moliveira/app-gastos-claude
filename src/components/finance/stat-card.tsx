import { Card, CardContent } from "@/components/ui/card";
import { formatBRL } from "@/lib/finance/money";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  cents: number;
  tone?: "neutral" | "income" | "expense";
  testId?: string;
  footer?: React.ReactNode;
};

export function StatCard({ label, cents, tone = "neutral", testId, footer }: Props) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "text-xl font-semibold tabular-nums tracking-tight",
            tone === "income" && "text-emerald-600 dark:text-emerald-400",
            tone === "expense" && "text-rose-600 dark:text-rose-400",
          )}
          data-testid={testId}
        >
          {formatBRL(cents)}
        </span>
        {footer ? <div className="text-xs text-muted-foreground">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
