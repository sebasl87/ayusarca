"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const jobSchema = z.object({
  id: z.string(),
  factura_id: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  last_error: z.string().nullable().optional(),
});

export default function JobsPage() {
  const jobsQuery = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const res = await fetch("/api/jobs");
      const json: unknown = await res.json();
      const parsed = z
        .object({ ok: z.literal(true), jobs: z.array(jobSchema) })
        .safeParse(json);
      if (!res.ok || !parsed.success) throw new Error("fetch_failed");
      return parsed.data.jobs;
    },
    refetchInterval: 2000,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
      {jobsQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : jobsQuery.isError ? (
        <div className="text-sm text-destructive">No se pudieron cargar los jobs.</div>
      ) : jobsQuery.data && jobsQuery.data.length > 0 ? (
        <div className="rounded-lg border border-border">
          <div className="grid grid-cols-12 gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <div className="col-span-5">Factura</div>
            <div className="col-span-2">Estado</div>
            <div className="col-span-3">Inicio</div>
            <div className="col-span-2">Fin</div>
          </div>
          {jobsQuery.data.map((j) => (
            <div
              key={j.id}
              className="grid grid-cols-12 gap-2 border-b border-border px-3 py-3 text-sm last:border-b-0"
            >
              <div className="col-span-5 truncate">{j.factura_id ?? "—"}</div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">{j.status ?? "—"}</div>
                {j.last_error ? (
                  <div className="mt-1 text-xs text-destructive">{j.last_error}</div>
                ) : null}
              </div>
              <div className="col-span-3 text-xs text-muted-foreground">
                {j.started_at ?? "—"}
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">
                {j.completed_at ?? "—"}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          Todavía no hay jobs.
        </div>
      )}
    </div>
  );
}
