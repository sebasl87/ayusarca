import { NextResponse } from "next/server";
import { z } from "zod";

import { encryptCredential } from "@/lib/crypto/credentials";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  cuit: z.string().regex(/^[0-9]{11}$/),
  claveFiscal: z.string().min(1),
});

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
    .from("arca_credentials")
    .select("cuit, last_used_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, credentials: data });
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
  const body = bodySchema.parse(json);
  const encrypted = encryptCredential(body.claveFiscal, user.id);

  const { error } = await supabase.from("arca_credentials").upsert(
    {
      user_id: user.id,
      cuit: body.cuit,
      clave_fiscal_encrypted: encrypted.ciphertext,
      clave_fiscal_iv: encrypted.iv,
      clave_fiscal_tag: encrypted.tag,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

