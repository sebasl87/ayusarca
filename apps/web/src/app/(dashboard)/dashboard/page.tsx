import Link from "next/link";

import { DashboardCategoryChart } from "@/components/organisms/DashboardCategoryChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const categoryData = user
    ? await (async () => {
        const { data, error } = await supabase
          .from("facturas")
          .select(
            "status, edited_categoria, extracted_categoria_sugerida, edited_monto_total, extracted_monto_total, created_at"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500);

        if (error || !data) return [];

        const byCategory = new Map<string, { total: number; count: number }>();
        for (const f of data) {
          const categoria =
            (f.edited_categoria as string | null | undefined) ??
            (f.extracted_categoria_sugerida as string | null | undefined) ??
            "Sin categoría";

          const monto =
            (f.edited_monto_total as number | null | undefined) ??
            (f.extracted_monto_total as number | null | undefined) ??
            0;

          const curr = byCategory.get(categoria) ?? { total: 0, count: 0 };
          byCategory.set(categoria, {
            total: curr.total + Number(monto) || curr.total,
            count: curr.count + 1,
          });
        }

        const rows = Array.from(byCategory.entries())
          .map(([categoria, v]) => ({ categoria, total: v.total, count: v.count }))
          .sort((a, b) => b.total - a.total);

        const top = rows.slice(0, 8);
        const rest = rows.slice(8);
        if (rest.length === 0) return top;

        const others = rest.reduce(
          (acc, r) => ({ total: acc.total + r.total, count: acc.count + r.count }),
          { total: 0, count: 0 }
        );

        return [...top, { categoria: "Otros", total: others.total, count: others.count }];
      })()
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Estado general de cargas y deducciones.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Facturas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{counts ? counts.total : "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{counts ? counts.pending : "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Cargadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{counts ? counts.loaded : "—"}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Monto por categoría (últimas 500)</CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardCategoryChart data={categoryData} />
        </CardContent>
      </Card>
      <div className="text-sm text-muted-foreground">
        <Link href="/facturas" className="underline underline-offset-4">
          Ir a facturas
        </Link>
      </div>
    </div>
  );
}
