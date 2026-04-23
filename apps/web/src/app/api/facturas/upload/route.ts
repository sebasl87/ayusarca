import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const files = form.getAll("files");
  const parsed = z.array(z.instanceof(File)).safeParse(files);
  if (!parsed.success || parsed.data.length === 0) {
    return NextResponse.json({ ok: false, error: "missing_files" }, { status: 400 });
  }

  const created: Array<{ id: string; storagePath: string; originalName: string }> = [];

  for (const file of parsed.data) {
    if (!allowedMimeTypes.has(file.type)) {
      return NextResponse.json({ ok: false, error: "unsupported_file_type" }, { status: 400 });
    }

    const ext =
      file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : undefined;
    const safeExt = ext ? ext.replace(/[^a-z0-9]/g, "") : "bin";
    const fileId = randomUUID();
    const storagePath = `${user.id}/${fileId}.${safeExt}`;

    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("facturas")
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
    }

    const { data: row, error: insertError } = await supabase
      .from("facturas")
      .insert({
        user_id: user.id,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        status: "uploaded",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !row) {
      return NextResponse.json(
        { ok: false, error: insertError?.message ?? "insert_failed" },
        { status: 500 }
      );
    }

    created.push({ id: row.id, storagePath, originalName: file.name });

    void supabase.from("audit_log").insert({
      user_id: user.id,
      action: "factura_uploaded",
      resource_type: "factura",
      resource_id: row.id,
      metadata: { original_filename: file.name, mime_type: file.type, size_bytes: file.size },
    });
  }

  return NextResponse.json({ ok: true, facturas: created });
}
