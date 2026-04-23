import type { Job } from "bullmq";

import { loginToArca } from "../arca/login";
import {
  IndumentariaAdapter,
  type IndumentariaInput,
} from "../arca/adapters/indumentaria";
import { decryptCredential } from "../lib/crypto/credentials";
import { supabaseAdmin } from "../lib/supabase";

export type CargarDeduccionJobData = {
  userId: string;
  facturaId: string;
  loadJobId: string;
};

export async function cargarDeduccion(job: Job<CargarDeduccionJobData>) {
  const { userId, facturaId, loadJobId } = job.data;
  await supabaseAdmin
    .from("load_jobs")
    .update({ status: "loading", started_at: new Date().toISOString() })
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
        "id, user_id, extracted_cuit, extracted_razon_social, extracted_tipo_comprobante, extracted_punto_venta, extracted_numero, extracted_fecha_emision, extracted_monto_total, extracted_categoria_sugerida, edited_cuit, edited_razon_social, edited_tipo_comprobante, edited_punto_venta, edited_numero, edited_fecha_emision, edited_monto_total, edited_categoria, edited_mes_deduccion, status"
      )
      .eq("id", facturaId)
      .eq("user_id", userId)
      .single();

    if (facturaError) throw new Error(facturaError.message);

    const categoria =
      (factura.edited_categoria ?? factura.extracted_categoria_sugerida) as
      | "indumentaria"
      | "equipamiento"
      | string
      | null
      | undefined;

    if (categoria !== "indumentaria" && categoria !== "equipamiento") {
      throw new Error("categoria_no_soportada");
    }

    const fechaIso = (factura.edited_fecha_emision ??
      (factura.extracted_fecha_emision as string | null)) as string | null;
    if (!fechaIso) throw new Error("missing_fecha_emision");
    const [yyyy, mm, dd] = fechaIso.split("-");
    if (!yyyy || !mm || !dd) throw new Error("invalid_fecha_emision");
    const fechaEmision = `${dd}/${mm}/${yyyy}`;

    const mes =
      (factura.edited_mes_deduccion ??
        (mm ? Number(mm) : null)) as number | null;
    if (!mes || Number.isNaN(mes) || mes < 1 || mes > 12) {
      throw new Error("missing_mes");
    }

    const tipo = (factura.edited_tipo_comprobante ??
      factura.extracted_tipo_comprobante) as string | null;
    const tipoComprobante = tipo === "A" ? 1 : tipo === "B" ? 6 : null;
    if (!tipoComprobante) throw new Error("tipo_comprobante_no_soportado");

    const monto = Number(
      factura.edited_monto_total ?? factura.extracted_monto_total ?? NaN
    );
    if (!Number.isFinite(monto) || monto <= 0) throw new Error("monto_invalido");

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
      throw new Error("missing_fields");
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

    const session = await loginToArca(cred.cuit, claveFiscal);
    const adapter = new IndumentariaAdapter(session.jsessionid);
    const res = await adapter.guardar({ ...input, concepto: categoria });

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
      })
      .eq("id", loadJobId);

    throw e;
  }
}
