import Link from "next/link";

import { FacturasList } from "@/components/organisms/FacturasList";

export default function FacturasPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
        <Link
          href="/facturas/upload"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Subir facturas
        </Link>
      </div>
      <FacturasList />
    </div>
  );
}
