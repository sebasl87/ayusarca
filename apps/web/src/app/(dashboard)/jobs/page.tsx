"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const jobSchema = z.object({
  id: z.string(),
  factura_id: z.string().nullable().optional(),
  original_filename: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  attempts: z.number().nullable().optional(),
  max_attempts: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  last_error: z.string().nullable().optional(),
});

type JobRow = z.infer<typeof jobSchema>;

function statusVariant(status: string | null | undefined) {
  if (status === "loaded") return "success" as const;
  if (status === "failed") return "destructive" as const;
  return "default" as const;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function JobsPage() {
  const qc = useQueryClient();
  const jobsQuery = useQuery({
    queryKey: ["jobs"],
    queryFn: async (): Promise<JobRow[]> => {
      const res = await fetch("/api/jobs");
      const json: unknown = await res.json();
      const parsed = z
        .object({ ok: z.literal(true), jobs: z.array(jobSchema) })
        .safeParse(json);
      if (!res.ok || !parsed.success) throw new Error("fetch_failed");
      return parsed.data.jobs;
    },
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;
    let cleanup: (() => void) | null = null;

    void supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId || !active) return;

      const channel = supabase
        .channel("jobs-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "load_jobs",
          filter: `user_id=eq.${userId}` },
          () => { void qc.invalidateQueries({ queryKey: ["jobs"] }); })
        .subscribe();

      cleanup = () => { void supabase.removeChannel(channel); };
    });

    return () => { active = false; cleanup?.(); };
  }, [qc]);

  const jobs = jobsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>

      {jobsQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : jobsQuery.isError ? (
        <div className="text-sm text-destructive">No se pudieron cargar los jobs.</div>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          Todavía no hay jobs.
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <div className="grid grid-cols-12 gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-4">Archivo</div>
            <div className="col-span-2">Estado</div>
            <div className="col-span-2">Intentos</div>
            <div className="col-span-2">Inicio</div>
            <div className="col-span-2">Fin</div>
          </div>
          {jobs.map((j) => (
            <div key={j.id}
              className="grid grid-cols-12 gap-2 border-b border-border px-3 py-3 text-sm last:border-b-0">
              <div className="col-span-4 truncate text-xs">
                {j.original_filename ?? j.factura_id ?? "—"}
              </div>
              <div className="col-span-2">
                <Badge variant={statusVariant(j.status)}>{j.status ?? "—"}</Badge>
                {j.last_error ? (
                  <div className="mt-1 text-xs text-destructive line-clamp-2">{j.last_error}</div>
                ) : null}
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">
                {j.attempts ?? 0}/{j.max_attempts ?? 3}
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">{fmtDate(j.started_at)}</div>
              <div className="col-span-2 text-xs text-muted-foreground">{fmtDate(j.completed_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
