"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";

const facturaSchema = z.object({
  id: z.string(),
  original_filename: z.string().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  extracted_cuit: z.string().nullable().optional(),
  extracted_razon_social: z.string().nullable().optional(),
  extracted_fecha_emision: z.string().nullable().optional(),
  extracted_monto_total: z.number().nullable().optional(),
  extracted_categoria_sugerida: z.string().nullable().optional(),
  edited_categoria: z.string().nullable().optional(),
  arca_deduccion_id: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
});

type FacturaRow = z.infer<typeof facturaSchema>;

export function FacturasList() {
  const qc = useQueryClient();

  const facturasQuery = useQuery({
    queryKey: ["facturas"],
    queryFn: async (): Promise<FacturaRow[]> => {
      const res = await fetch("/api/facturas");
      const json: unknown = await res.json();
      const parsed = z
        .object({ ok: z.literal(true), facturas: z.array(facturaSchema) })
        .safeParse(json);
      if (!res.ok || !parsed.success) throw new Error("fetch_failed");
      return parsed.data.facturas;
    },
  });

  const extractMutation = useMutation({
    mutationFn: async (facturaId: string) => {
      const res = await fetch("/api/facturas/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facturaId }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const err = z.object({ error: z.string().optional() }).safeParse(json);
        throw new Error(err.success ? err.data.error ?? "extract_failed" : "extract_failed");
      }
      return json;
    },
    onSuccess: async () => {
      toast.success("Extracción OK");
      await qc.invalidateQueries({ queryKey: ["facturas"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error extrayendo"),
  });

  const enqueueMutation = useMutation({
    mutationFn: async (facturaId: string) => {
      const res = await fetch("/api/jobs/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facturaIds: [facturaId] }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const err = z.object({ error: z.string().optional() }).safeParse(json);
        throw new Error(err.success ? err.data.error ?? "enqueue_failed" : "enqueue_failed");
      }
      return json;
    },
    onSuccess: async () => {
      toast.success("Job encolado");
      await qc.invalidateQueries({ queryKey: ["facturas"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error encolando job"),
  });

  if (facturasQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando…</div>;
  }

  if (facturasQuery.isError) {
    return <div className="text-sm text-destructive">No se pudieron cargar las facturas.</div>;
  }

  const facturas = facturasQuery.data ?? [];

  if (facturas.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Todavía no hay facturas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border">
        <div className="grid grid-cols-12 gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
          <div className="col-span-4">Archivo</div>
          <div className="col-span-2">Estado</div>
          <div className="col-span-3">Proveedor</div>
          <div className="col-span-2">Total</div>
          <div className="col-span-1 text-right">Acción</div>
        </div>
        {facturas.map((f) => {
          const categoria = f.edited_categoria ?? f.extracted_categoria_sugerida ?? null;
          const canExtract = f.status === "uploaded" || f.status === "failed";
          const canEnqueue = f.status === "extracted" || f.status === "ready";

          return (
            <div
              key={f.id}
              className="grid grid-cols-12 gap-2 border-b border-border px-3 py-3 text-sm last:border-b-0"
            >
              <div className="col-span-4 truncate">{f.original_filename ?? f.id}</div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">{f.status ?? "—"}</div>
                {f.error_message ? (
                  <div className="mt-1 text-xs text-destructive">{f.error_message}</div>
                ) : null}
              </div>
              <div className="col-span-3 truncate">
                <div className="truncate">{f.extracted_razon_social ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {f.extracted_cuit ?? "—"} · {categoria ?? "—"}
                </div>
              </div>
              <div className="col-span-2">
                {typeof f.extracted_monto_total === "number"
                  ? f.extracted_monto_total.toFixed(2)
                  : "—"}
              </div>
              <div className="col-span-1 flex justify-end">
                {canExtract ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={extractMutation.isPending || enqueueMutation.isPending}
                    onClick={() => extractMutation.mutate(f.id)}
                  >
                    Extraer
                  </Button>
                ) : canEnqueue ? (
                  <Button
                    size="sm"
                    disabled={extractMutation.isPending || enqueueMutation.isPending}
                    onClick={() => enqueueMutation.mutate(f.id)}
                  >
                    Encolar
                  </Button>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {f.arca_deduccion_id ? "Cargada" : "—"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

