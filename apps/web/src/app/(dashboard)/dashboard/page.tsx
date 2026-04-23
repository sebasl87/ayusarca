import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardHomePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const counts = user
    ? await (async () => {
        const [{ count: total }, { count: loaded }] = await Promise.all([
          supabase
            .from("facturas")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("facturas")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "loaded"),
        ]);

        const totalCount = total ?? 0;
        const loadedCount = loaded ?? 0;
        return {
          total: totalCount,
          loaded: loadedCount,
          pending: Math.max(0, totalCount - loadedCount),
        };
      })()
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Estado general de cargas y deducciones.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <div className="text-sm text-muted-foreground">Facturas</div>
          <div className="text-2xl font-semibold">
            {counts ? counts.total : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="text-sm text-muted-foreground">Pendientes</div>
          <div className="text-2xl font-semibold">
            {counts ? counts.pending : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="text-sm text-muted-foreground">Cargadas</div>
          <div className="text-2xl font-semibold">
            {counts ? counts.loaded : "—"}
          </div>
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        <Link href="/facturas" className="underline underline-offset-4">
          Ir a facturas
        </Link>
      </div>
    </div>
  );
}
