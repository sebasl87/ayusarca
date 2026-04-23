import { NextResponse } from "next/server";
import { z } from "zod";

import { facturaEditedSchema } from "@siradig/shared/schemas/factura";

import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  edited: facturaEditedSchema,
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const { edited } = bodySchema.parse(json);
  const facturaId = ctx.params.id;

  const { error } = await supabase
    .from("facturas")
    .update({
      edited_cuit: edited.cuit,
      edited_razon_social: edited.razonSocial,
      edited_tipo_comprobante: edited.tipoComprobante,
      edited_punto_venta: edited.puntoVenta,
      edited_numero: edited.numero,
      edited_fecha_emision: edited.fechaEmision,
      edited_monto_total: edited.montoTotal,
      edited_categoria: edited.categoria,
      edited_mes_deduccion: edited.mesDeduccion,
      edited_id_concepto: edited.idConcepto ?? null,
      status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", facturaId)
    .eq("user_id", user.id);

  if (error) {
    logger.error({ err: error, facturaId }, "factura_update_failed");
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
