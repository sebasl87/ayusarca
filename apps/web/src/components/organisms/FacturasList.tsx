"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Cell,
  type CellContext,
  type Header,
  type HeaderGroup,
  type Row,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { facturaEditedSchema } from "@siradig/shared/schemas/factura";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const facturaSchema = z.object({
  id: z.string(),
  original_filename: z.string().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  size_bytes: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  extracted_cuit: z.string().nullable().optional(),
  extracted_razon_social: z.string().nullable().optional(),
  extracted_tipo_comprobante: z.string().nullable().optional(),
  extracted_punto_venta: z.string().nullable().optional(),
  extracted_numero: z.string().nullable().optional(),
  extracted_fecha_emision: z.string().nullable().optional(),
  extracted_monto_total: z.number().nullable().optional(),
  extracted_categoria_sugerida: z.string().nullable().optional(),
  extraction_confidence: z.number().nullable().optional(),
  edited_cuit: z.string().nullable().optional(),
  edited_razon_social: z.string().nullable().optional(),
  edited_tipo_comprobante: z.string().nullable().optional(),
  edited_punto_venta: z.string().nullable().optional(),
  edited_numero: z.string().nullable().optional(),
  edited_fecha_emision: z.string().nullable().optional(),
  edited_monto_total: z.number().nullable().optional(),
  edited_categoria: z.string().nullable().optional(),
  edited_mes_deduccion: z.number().nullable().optional(),
  edited_id_concepto: z.number().nullable().optional(),
  arca_deduccion_id: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
});

type FacturaRow = z.infer<typeof facturaSchema>;

type Draft = {
  cuit?: string;
  razonSocial?: string;
  tipoComprobante?: string;
  puntoVenta?: string;
  numero?: string;
  fechaEmision?: string;
  montoTotal?: number;
  categoria?: string;
  mesDeduccion?: number;
  idConcepto?: number;
};

function statusVariant(status: string | null | undefined) {
  if (status === "loaded") return "success" as const;
  if (status === "failed") return "destructive" as const;
  return "default" as const;
}

function getEditableDefaults(f: FacturaRow) {
  return {
    cuit: f.edited_cuit ?? f.extracted_cuit ?? "",
    razonSocial: f.edited_razon_social ?? f.extracted_razon_social ?? "",
    tipoComprobante:
      f.edited_tipo_comprobante ?? f.extracted_tipo_comprobante ?? "",
    puntoVenta: f.edited_punto_venta ?? f.extracted_punto_venta ?? "",
    numero: f.edited_numero ?? f.extracted_numero ?? "",
    fechaEmision: f.edited_fecha_emision ?? f.extracted_fecha_emision ?? "",
    montoTotal:
      typeof f.edited_monto_total === "number"
        ? f.edited_monto_total
        : typeof f.extracted_monto_total === "number"
          ? f.extracted_monto_total
          : 0,
    categoria: f.edited_categoria ?? f.extracted_categoria_sugerida ?? "",
    mesDeduccion:
      typeof f.edited_mes_deduccion === "number"
        ? f.edited_mes_deduccion
        : typeof f.extracted_fecha_emision === "string"
          ? Number(f.extracted_fecha_emision.split("-")[1] ?? 0)
          : 0,
    idConcepto:
      typeof f.edited_id_concepto === "number"
        ? f.edited_id_concepto
        : undefined,
  };
}

export function FacturasList() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

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
        throw new Error(
          err.success ? (err.data.error ?? "extract_failed") : "extract_failed",
        );
      }
      return json;
    },
    onSuccess: async () => {
      toast.success("Extracción OK");
      await qc.invalidateQueries({ queryKey: ["facturas"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Error extrayendo"),
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
        throw new Error(
          err.success ? (err.data.error ?? "enqueue_failed") : "enqueue_failed",
        );
      }
      return json;
    },
    onSuccess: async () => {
      toast.success("Job encolado");
      await qc.invalidateQueries({ queryKey: ["facturas"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Error encolando job"),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      facturaId: string;
      edited: z.infer<typeof facturaEditedSchema>;
    }) => {
      const res = await fetch(`/api/facturas/${payload.facturaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited: payload.edited }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const err = z.object({ error: z.string().optional() }).safeParse(json);
        throw new Error(
          err.success ? (err.data.error ?? "save_failed") : "save_failed",
        );
      }
    },
    onSuccess: async () => {
      toast.success("Guardado");
      await qc.invalidateQueries({ queryKey: ["facturas"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Error guardando"),
  });

  const facturas = facturasQuery.data ?? [];

  const columns = useMemo(() => {
    const col = createColumnHelper<FacturaRow>();

    return [
      col.accessor("original_filename", {
        header: "Archivo",
        cell: (ctx: CellContext<FacturaRow, string | null | undefined>) => (
          <div className="max-w-[240px] truncate">
            {ctx.getValue() ?? ctx.row.original.id}
          </div>
        ),
      }),
      col.accessor("status", {
        header: "Estado",
        cell: (ctx: CellContext<FacturaRow, string | null | undefined>) => {
          const status = ctx.getValue() ?? "—";
          const error = ctx.row.original.error_message;
          return (
            <div className="space-y-1">
              <Badge variant={statusVariant(status)}>{status}</Badge>
              {error ? (
                <div className="text-xs text-destructive">{error}</div>
              ) : null}
            </div>
          );
        },
      }),
      col.display({
        id: "cuit",
        header: "CUIT",
        cell: (ctx: CellContext<FacturaRow, unknown>) => {
          const base = getEditableDefaults(ctx.row.original);
          const value = drafts[ctx.row.original.id]?.cuit ?? base.cuit;
          return (
            <Input
              className="h-9 w-[140px]"
              value={value}
              onChange={(e) =>
                setDrafts((d) => ({
                  ...d,
                  [ctx.row.original.id]: {
                    ...d[ctx.row.original.id],
                    cuit: e.target.value,
                  },
                }))
              }
            />
          );
        },
      }),
      col.display({
        id: "razonSocial",
        header: "Razón social",
        cell: (ctx: CellContext<FacturaRow, unknown>) => {
          const base = getEditableDefaults(ctx.row.original);
          const value =
            drafts[ctx.row.original.id]?.razonSocial ?? base.razonSocial;
          return (
            <Input
              value={value}
              onChange={(e) =>
                setDrafts((d) => ({
                  ...d,
                  [ctx.row.original.id]: {
                    ...d[ctx.row.original.id],
                    razonSocial: e.target.value,
                  },
                }))
              }
            />
          );
        },
      }),
      col.display({
        id: "categoria",
        header: "Categoría",
        cell: (ctx: CellContext<FacturaRow, unknown>) => {
          const base = getEditableDefaults(ctx.row.original);
          const value =
            drafts[ctx.row.original.id]?.categoria ?? base.categoria;
          return (
            <Input
              className="h-9 w-[170px]"
              value={value}
              onChange={(e) =>
                setDrafts((d) => ({
                  ...d,
                  [ctx.row.original.id]: {
                    ...d[ctx.row.original.id],
                    categoria: e.target.value,
                  },
                }))
              }
            />
          );
        },
      }),
      col.display({
        id: "idConcepto",
        header: "Concepto",
        cell: (ctx: CellContext<FacturaRow, unknown>) => {
          const base = getEditableDefaults(ctx.row.original);
          const value =
            drafts[ctx.row.original.id]?.idConcepto ?? base.idConcepto ?? "";
          return (
            <Input
              className="h-9 w-[100px]"
              inputMode="numeric"
              value={String(value)}
              onChange={(e) => {
                const raw = e.target.value.trim();
                setDrafts((d) => ({
                  ...d,
                  [ctx.row.original.id]: {
                    ...d[ctx.row.original.id],
                    idConcepto: raw === "" ? undefined : Number(raw),
                  },
                }));
              }}
            />
          );
        },
      }),
      col.display({
        id: "fechaEmision",
        header: "Fecha",
        cell: (ctx: CellContext<FacturaRow, unknown>) => {
          const base = getEditableDefaults(ctx.row.original);
          const value =
            drafts[ctx.row.original.id]?.fechaEmision ?? base.fechaEmision;
          return (
            <Input
              value={value}
              onChange={(e) =>
                setDrafts((d) => ({
                  ...d,
                  [ctx.row.original.id]: {
                    ...d[ctx.row.original.id],
                    fechaEmision: e.target.value,
                  },
                }))
              }
            />
          );
        },
      }),
      col.display({
        id: "montoTotal",
        header: "Total",
        cell: (ctx: CellContext<FacturaRow, unknown>) => {
          const base = getEditableDefaults(ctx.row.original);
          const value =
            drafts[ctx.row.original.id]?.montoTotal ?? base.montoTotal;
          return (
            <Input
              inputMode="decimal"
              value={String(value)}
              onChange={(e) =>
                setDrafts((d) => ({
                  ...d,
                  [ctx.row.original.id]: {
                    ...d[ctx.row.original.id],
                    montoTotal: Number(e.target.value),
                  },
                }))
              }
            />
          );
        },
      }),
      col.display({
        id: "actions",
        header: "",
        cell: (ctx: CellContext<FacturaRow, unknown>) => {
          const f = ctx.row.original;
          const canExtract = f.status === "uploaded" || f.status === "failed";
          const canEnqueue = f.status === "extracted" || f.status === "ready";
          const base = getEditableDefaults(f);
          const draft = drafts[f.id] ?? {};
          const merged = { ...base, ...draft };
          const disabled =
            extractMutation.isPending ||
            enqueueMutation.isPending ||
            saveMutation.isPending;

          return (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  const parsed = facturaEditedSchema.safeParse({
                    cuit: merged.cuit,
                    razonSocial: merged.razonSocial,
                    tipoComprobante: merged.tipoComprobante,
                    puntoVenta: merged.puntoVenta,
                    numero: merged.numero,
                    fechaEmision: merged.fechaEmision,
                    montoTotal: merged.montoTotal,
                    categoria: merged.categoria,
                    mesDeduccion: merged.mesDeduccion,
                    idConcepto: merged.idConcepto,
                  });
                  if (!parsed.success) {
                    toast.error("Campos inválidos");
                    return;
                  }
                  saveMutation.mutate({ facturaId: f.id, edited: parsed.data });
                }}
              >
                Guardar
              </Button>
              {canExtract ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => extractMutation.mutate(f.id)}
                >
                  Extraer
                </Button>
              ) : canEnqueue ? (
                <Button
                  size="sm"
                  disabled={disabled}
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
          );
        },
      }),
    ];
  }, [drafts, enqueueMutation, extractMutation, saveMutation]);

  const table = useReactTable({
    data: facturas,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (facturasQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando…</div>;
  }

  if (facturasQuery.isError) {
    return (
      <div className="text-sm text-destructive">
        No se pudieron cargar las facturas.
      </div>
    );
  }

  if (facturas.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Todavía no hay facturas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg: HeaderGroup<FacturaRow>) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header: Header<FacturaRow, unknown>) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row: Row<FacturaRow>) => (
              <TableRow key={row.id}>
                {row
                  .getVisibleCells()
                  .map((cell: Cell<FacturaRow, unknown>) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
