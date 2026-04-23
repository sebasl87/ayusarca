import type { Job } from "bullmq";

import {
  IndumentariaAdapter,
  type IndumentariaInput,
} from "../arca/adapters/indumentaria";
import { EducacionAdapter } from "../arca/adapters/educacion";
import { AlquilerAdapter } from "../arca/adapters/alquiler";
import { MedicinaPrepagaAdapter } from "../arca/adapters/medicinaPrepaga";
import { getArcaSession } from "../arca/session";
import { decryptCredential } from "../lib/crypto/credentials";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase";
import { ArcaRateLimitError, ValidationError } from "@siradig/shared/errors";

export type CargarDeduccionJobData = {
  userId: string;
  facturaId: string;
  loadJobId: string;
};

export async function cargarDeduccion(job: Job<CargarDeduccionJobData>) {
  const { userId, facturaId, loadJobId } = job.data;
  await supabaseAdmin
    .from("load_jobs")
    .update({
      status: "loading",
      started_at: new Date().toISOString(),
      attempts: job.attemptsMade + 1,
    })
    .eq("id", loadJobId);

  try {
    const { data: cred, error: credError } = await supabaseAdmin
      .from("arca_credentials")
      .select("cuit, clave_fiscal_encrypted, clave_fiscal_iv, clave_fiscal_tag")
      .eq("user_id", userId)
      .single();

    if (credError) throw new Error(credError.message);

    const claveFiscal = decryptCredential(
      {
        ciphertext: cred.clave_fiscal_encrypted,
        iv: cred.clave_fiscal_iv,
        tag: cred.clave_fiscal_tag,
      },
      userId
    );

    const { data: factura, error: facturaError } = await supabaseAdmin
      .from("facturas")
      .select(
        "id, user_id, extracted_cuit, extracted_razon_social, extracted_tipo_comprobante, extracted_punto_venta, extracted_numero, extracted_fecha_emision, extracted_monto_total, extracted_categoria_sugerida, edited_cuit, edited_razon_social, edited_tipo_comprobante, edited_punto_venta, edited_numero, edited_fecha_emision, edited_monto_total, edited_categoria, edited_mes_deduccion, edited_id_concepto, status"
      )
      .eq("id", facturaId)
      .eq("user_id", userId)
      .single();

    if (facturaError) throw new Error(facturaError.message);

    const categoria =
      (factura.edited_categoria ?? factura.extracted_categoria_sugerida) as
      | "indumentaria"
      | "equipamiento"
      | "educacion"
      | "alquiler"
      | "medicina_prepaga"
      | string
      | null
      | undefined;

    if (
      categoria !== "indumentaria" &&
      categoria !== "equipamiento" &&
      categoria !== "educacion" &&
      categoria !== "alquiler" &&
      categoria !== "medicina_prepaga"
    ) {
      throw new ValidationError("categoria_no_soportada");
    }

    const fechaIso = (factura.edited_fecha_emision ??
      (factura.extracted_fecha_emision as string | null)) as string | null;
    if (!fechaIso) throw new ValidationError("missing_fecha_emision");
    const [yyyy, mm, dd] = fechaIso.split("-");
    if (!yyyy || !mm || !dd) throw new ValidationError("invalid_fecha_emision");
    const fechaEmision = `${dd}/${mm}/${yyyy}`;

    const mes =
      (factura.edited_mes_deduccion ??
        (mm ? Number(mm) : null)) as number | null;
    if (!mes || Number.isNaN(mes) || mes < 1 || mes > 12) {
      throw new ValidationError("missing_mes");
    }

    const tipo = (factura.edited_tipo_comprobante ??
      factura.extracted_tipo_comprobante) as string | null;
    const tipoComprobante = tipo === "A" ? 1 : tipo === "B" ? 6 : null;
    if (!tipoComprobante) throw new ValidationError("tipo_comprobante_no_soportado");

    const monto = Number(
      factura.edited_monto_total ?? factura.extracted_monto_total ?? NaN
    );
    if (!Number.isFinite(monto) || monto <= 0) throw new ValidationError("monto_invalido");

    const cuitDoc = (factura.edited_cuit ?? factura.extracted_cuit) as
      | string
      | null
      | undefined;
    const razonSocial = (factura.edited_razon_social ??
      factura.extracted_razon_social) as string | null | undefined;
    const puntoVenta = (factura.edited_punto_venta ??
      factura.extracted_punto_venta) as string | null | undefined;
    const numero = (factura.edited_numero ?? factura.extracted_numero) as
      | string
      | null
      | undefined;

    if (!cuitDoc || !razonSocial || !puntoVenta || !numero) {
      throw new ValidationError("missing_fields");
    }

    const input: Omit<IndumentariaInput, "concepto"> = {
      cuit: cuitDoc,
      razonSocial,
      mes,
      monto,
      fechaEmision,
      tipoComprobante,
      puntoVenta,
      numero,
    };

    const idConcepto = Number(
      (factura as { edited_id_concepto?: number | null }).edited_id_concepto ?? NaN
    );
    if (
      (categoria === "educacion" || categoria === "alquiler" || categoria === "medicina_prepaga") &&
      (!Number.isFinite(idConcepto) || idConcepto <= 0)
    ) {
      throw new ValidationError("missing_id_concepto");
    }

    const session = await getArcaSession({ userId, cuit: cred.cuit, claveFiscal });
    const res =
      categoria === "indumentaria" || categoria === "equipamiento"
        ? await new IndumentariaAdapter(session.jsessionid).guardar({ ...input, concepto: categoria })
        : categoria === "educacion"
          ? await new EducacionAdapter(session.jsessionid).guardar({ ...input, idConcepto })
          : categoria === "alquiler"
            ? await new AlquilerAdapter(session.jsessionid).guardar({ ...input, idConcepto })
            : await new MedicinaPrepagaAdapter(session.jsessionid).guardar({ ...input, idConcepto });

    if (!res.success) throw new Error(res.error ?? "arca_error");

    await supabaseAdmin
      .from("facturas")
      .update({
        status: "loaded",
        arca_deduccion_id: res.arcaId ?? null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", facturaId)
      .eq("user_id", userId);

    await supabaseAdmin
      .from("load_jobs")
      .update({
        status: "loaded",
        completed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", loadJobId);

    return { ok: true, arcaId: res.arcaId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "error";
    if (e instanceof ValidationError) job.discard();
    if (e instanceof ArcaRateLimitError) logger.error({ err: e }, "arca_rate_limited");
    await supabaseAdmin
      .from("facturas")
      .update({
        status: "failed",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", facturaId)
      .eq("user_id", userId);

    await supabaseAdmin
      .from("load_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        last_error: message,
        attempts: job.attemptsMade + 1,
      })
      .eq("id", loadJobId);

    throw e;
  }
}
