import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("facturas")
    .select(
      "id, original_filename, mime_type, status, created_at, updated_at, extracted_cuit, extracted_razon_social, extracted_tipo_comprobante, extracted_punto_venta, extracted_numero, extracted_fecha_emision, extracted_monto_total, extracted_categoria_sugerida, edited_categoria, arca_deduccion_id, error_message"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, facturas: data ?? [] });
}

