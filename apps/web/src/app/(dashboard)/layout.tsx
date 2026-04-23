import Link from "next/link";
import type { ReactNode } from "react";

export default function DashboardLayout(props: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            SiRADIG Auto-Loader
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/facturas">Facturas</Link>
            <Link href="/jobs">Jobs</Link>
            <Link href="/configuracion/credenciales-arca">ARCA</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{props.children}</main>
    </div>
  );
}
