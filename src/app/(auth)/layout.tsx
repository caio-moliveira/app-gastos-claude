import { Vault } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Vault className="size-6 text-primary" aria-hidden />
        Cofre
      </div>
      {children}
    </main>
  );
}
