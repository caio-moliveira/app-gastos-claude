"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { maskAmountInput } from "@/lib/finance/money";

type Props = {
  id: string;
  name: string;
  defaultValue?: string;
  /** Permite sinal negativo (saldo inicial de cartão de crédito). */
  allowNegative?: boolean;
  required?: boolean;
  "aria-invalid"?: boolean;
};

/** Campo de valor em reais com máscara (dígitos viram centavos: 123456 → 1.234,56). */
export function AmountInput({ id, name, defaultValue = "", allowNegative = false, required, ...rest }: Props) {
  const [negative, setNegative] = useState(allowNegative && defaultValue.trim().startsWith("-"));
  const [value, setValue] = useState(maskAmountInput(defaultValue));

  return (
    <div className="flex items-center gap-2">
      {allowNegative ? (
        <button
          type="button"
          onClick={() => setNegative((n) => !n)}
          className="h-8 shrink-0 rounded-lg border px-2 text-sm font-medium tabular-nums"
          aria-label={negative ? "Valor negativo (clique para positivo)" : "Valor positivo (clique para negativo)"}
        >
          {negative ? "−" : "+"}
        </button>
      ) : null}
      <div className="relative w-full">
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
          R$
        </span>
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0,00"
          className="pl-9 tabular-nums"
          value={value}
          onChange={(e) => setValue(maskAmountInput(e.target.value))}
          required={required}
          aria-invalid={rest["aria-invalid"]}
        />
        <input type="hidden" name={name} value={value ? `${negative ? "-" : ""}${value}` : ""} />
      </div>
    </div>
  );
}
