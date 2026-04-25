import type { Job } from "bullmq";

import { IndumentariaAdapter } from "../arca/adapters/indumentaria";
import { EducacionAdapter } from "../arca/adapters/educacion";
import { AlquilerAdapter } from "../arca/adapters/alquiler";
import { MedicinaPrepagaAdapter } from "../arca/adapters/medicinaPrepaga";
import { PrimasSeguroAdapter } from "../arca/adapters/primasSeguro";
import { DonacionesAdapter } from "../arca/adapters/donaciones";
import { ServicioDomesticoAdapter } from "../arca/adapters/servicioDomestico";
import { GastosMedicosAdapter } from "../arca/adapters/gastosMedicos";
import { InteresesHipotecariosAdapter } from "../arca/adapters/interesesHipotecarios";
import { getArcaSession, invalidateArcaSession } from "../arca/session";
import { decryptCredential } from "../lib/crypto/credentials";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase";
import {
  ArcaRateLimitError,
  ArcaSessionExpiredError,
  ArcaValidationError,
  ValidationError,
} from "@siradig/shared/errors";
import { friendlyArcaError } from "../arca/errorMessages";
import type { ArcaCategoria } from "@siradig/shared/types/arca";

export type CargarDeduccionJobData = {
  userId: string;
  facturaId: string;
  loadJobId: string;
};

const CATEGORIAS_CON_CONCEPTO = new Set<ArcaCategoria>([
  "educacion",
  "alquiler",
  "medicina_prepaga",
  "primas_seguro",
  "donaciones",
  "servicio_domestico",
  "gastos_medicos",
  "intereses_hipotecarios",
]);

const TIPO_COMPROBANTE_MAP: Record<string, number> = {
  A: 1,
  B: 6,
  C: 11,
  M: 51,
  E: 201,
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
      .select(
        "cuit, clave_fiscal_encrypted, clave_fiscal_iv, clave_fiscal_tag"
      )
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

    const categoria = (factura.edited_categoria ??
      factura.extracted_categoria_sugerida) as ArcaCategoria | null | undefined;

    const validCategorias: ArcaCategoria[] = [
      "indumentaria",
      "equipamiento",
      "educacion",
      "alquiler",
      "medicina_prepaga",
      "primas_seguro",
      "donaciones",
      "servicio_domestico",
      "gastos_medicos",
      "intereses_hipotecarios",
    ];

    if (!categoria || !validCategorias.includes(categoria)) {
      throw new ValidationError("categoria_no_soportada");
    }

    const fechaIso = (factura.edited_fecha_emision ??
      factura.extracted_fecha_emision) as string | null;
    if (!fechaIso) throw new ValidationError("missing_fecha_emision");
    const [yyyy, mm, dd] = fechaIso.split("-");
    if (!yyyy || !mm || !dd) throw new ValidationError("invalid_fecha_emision");
    const fechaEmision = `${dd}/${mm}/${yyyy}`;

    const mes = (factura.edited_mes_deduccion ??
      (mm ? Number(mm) : null)) as number | null;
    if (!mes || Number.isNaN(mes) || mes < 1 || mes > 12) {
      throw new ValidationError("missing_mes");
    }

    const tipoStr = (factura.edited_tipo_comprobante ??
      factura.extracted_tipo_comprobante) as string | null;
    const tipoComprobante = tipoStr ? TIPO_COMPROBANTE_MAP[tipoStr] : null;
    if (!tipoComprobante) throw new ValidationError("tipo_comprobante_no_soportado");

    const monto = Number(
      factura.edited_monto_total ?? factura.extracted_monto_total ?? NaN
    );
    if (!Number.isFinite(monto) || monto <= 0) throw new ValidationError("monto_invalido");

    const cuitDoc = (factura.edited_cuit ?? factura.extracted_cuit) as string | null;
    const razonSocial = (factura.edited_razon_social ??
      factura.extracted_razon_social) as string | null;
    const puntoVenta = (factura.edited_punto_venta ??
      factura.extracted_punto_venta) as string | null;
    const numero = (factura.edited_numero ?? factura.extracted_numero) as string | null;

    if (!cuitDoc || !razonSocial || !puntoVenta || !numero) {
      throw new ValidationError("missing_fields");
    }

    const idConcepto = Number(
      (factura as { edited_id_concepto?: number | null }).edited_id_concepto ?? NaN
    );
    if (
      CATEGORIAS_CON_CONCEPTO.has(categoria) &&
      (!Number.isFinite(idConcepto) || idConcepto <= 0)
    ) {
      throw new ValidationError("missing_id_concepto");
    }

    const session = await getArcaSession({ userId, cuit: cred.cuit, claveFiscal });
    const { jsessionid, extraCookies } = session;

    const baseInput = { cuit: cuitDoc, razonSocial, mes, monto, fechaEmision, tipoComprobante, puntoVenta, numero };
    const withConcepto = { ...baseInput, idConcepto };

    let res: { success: boolean; arcaId?: string; error?: string };

    switch (categoria) {
      case "indumentaria":
      case "equipamiento":
        res = await new IndumentariaAdapter(jsessionid, extraCookies).guardar({ ...baseInput, concepto: categoria });
        break;
      case "educacion":
        res = await new EducacionAdapter(jsessionid, extraCookies).guardar(withConcepto);
        break;
      case "alquiler":
        res = await new AlquilerAdapter(jsessionid, extraCookies).guardar(withConcepto);
        break;
      case "medicina_prepaga":
        res = await new MedicinaPrepagaAdapter(jsessionid, extraCookies).guardar(withConcepto);
        break;
      case "primas_seguro":
        res = await new PrimasSeguroAdapter(jsessionid, extraCookies).guardar(withConcepto);
        break;
      case "donaciones":
        res = await new DonacionesAdapter(jsessionid, extraCookies).guardar(withConcepto);
        break;
      case "servicio_domestico":
        res = await new ServicioDomesticoAdapter(jsessionid, extraCookies).guardar(withConcepto);
        break;
      case "gastos_medicos":
        res = await new GastosMedicosAdapter(jsessionid, extraCookies).guardar(withConcepto);
        break;
      case "intereses_hipotecarios":
        res = await new InteresesHipotecariosAdapter(jsessionid, extraCookies).guardar(withConcepto);
        break;
    }

    if (!res.success) throw new ArcaValidationError(friendlyArcaError(res.error ?? "arca_error"));

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

    logger.info({ facturaId, categoria, arcaId: res.arcaId }, "deduccion_cargada");
    return { ok: true, arcaId: res.arcaId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "error";
    if (e instanceof ValidationError || e instanceof ArcaValidationError) job.discard();
    if (e instanceof ArcaSessionExpiredError) await invalidateArcaSession(userId);
    if (e instanceof ArcaRateLimitError) logger.error({ err: e }, "arca_rate_limited");
    logger.error({ err: e, facturaId, userId }, "cargar_deduccion_failed");

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
