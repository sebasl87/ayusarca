import { NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";

import { extractFacturaFromImage } from "@/lib/anthropic/extractFactura";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  facturaId: z.string().min(1),
});

function inferImageInput(params: { mimeType: string; buffer: Buffer }) {
  if (params.mimeType === "image/png") return { buffer: params.buffer, mimeType: "image/png" as const };
  if (params.mimeType === "image/jpeg") return { buffer: params.buffer, mimeType: "image/jpeg" as const };
  if (params.mimeType === "image/webp") return { buffer: params.buffer, mimeType: "image/webp" as const };
  if (params.mimeType === "image/gif") return { buffer: params.buffer, mimeType: "image/gif" as const };
  return null;
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const { facturaId } = bodySchema.parse(json);

  const { data: factura, error: facturaError } = await supabase
    .from("facturas")
    .select("id, user_id, storage_bucket, storage_path, mime_type")
    .eq("id", facturaId)
    .eq("user_id", user.id)
    .single();

  if (facturaError || !factura) {
    return NextResponse.json(
      { ok: false, error: facturaError?.message ?? "not_found" },
      { status: 404 }
    );
  }

  await supabase
    .from("facturas")
    .update({ status: "extracting", updated_at: new Date().toISOString() })
    .eq("id", facturaId)
    .eq("user_id", user.id);

  const { data: download, error: downloadError } = await supabase.storage
    .from(factura.storage_bucket)
    .download(factura.storage_path);

  if (downloadError || !download) {
    await supabase
      .from("facturas")
      .update({
        status: "failed",
        error_message: downloadError?.message ?? "download_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", facturaId)
      .eq("user_id", user.id);

    return NextResponse.json(
      { ok: false, error: downloadError?.message ?? "download_failed" },
      { status: 500 }
    );
  }

  const baseBytes = Buffer.from(await download.arrayBuffer());

  let imageBuffer: Buffer;
  try {
    if (factura.mime_type === "application/pdf") {
      imageBuffer = await sharp(baseBytes, { density: 220 }).png().toBuffer();
    } else {
      imageBuffer = await sharp(baseBytes).png().toBuffer();
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "pdf_or_image_convert_failed";
    await supabase
      .from("facturas")
      .update({
        status: "failed",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", facturaId)
      .eq("user_id", user.id);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const imageInput = inferImageInput({ buffer: imageBuffer, mimeType: "image/png" });
  if (!imageInput) {
    return NextResponse.json({ ok: false, error: "invalid_image" }, { status: 500 });
  }

  try {
    const { data, raw } = await extractFacturaFromImage(imageInput);

    await supabase
      .from("facturas")
      .update({
        status: "extracted",
        extracted_cuit: data.cuit_emisor,
        extracted_razon_social: data.razon_social,
        extracted_tipo_comprobante: data.tipo_comprobante,
        extracted_punto_venta: data.punto_venta,
        extracted_numero: data.numero_comprobante,
        extracted_fecha_emision: data.fecha_emision,
        extracted_monto_total: data.monto_total,
        extracted_categoria_sugerida: data.categoria_sugerida,
        extracted_confianza: data.confianza,
        extracted_observaciones: data.observaciones,
        extracted_raw: raw,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", facturaId)
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true, extraction: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "extract_failed";
    await supabase
      .from("facturas")
      .update({
        status: "failed",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", facturaId)
      .eq("user_id", user.id);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

