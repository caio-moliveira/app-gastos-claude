import type { FormState } from "@/lib/forms";

export function FormMessage({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error && !state.fieldErrors) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
        {state.success}
      </p>
    );
  }
  return null;
}

export function FieldError({ state, name }: { state: FormState; name: string }) {
  const message = state?.fieldErrors?.[name];
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}
