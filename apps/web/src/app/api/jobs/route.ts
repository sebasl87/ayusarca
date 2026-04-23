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
    .from("load_jobs")
    .select(
      "id, factura_id, status, attempts, max_attempts, created_at, started_at, completed_at, last_error, facturas(original_filename)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const jobs = (data ?? []).map((j) => ({
    id: j.id,
    factura_id: j.factura_id,
    original_filename:
      ((j.facturas as unknown) as { original_filename: string | null } | null)
        ?.original_filename ?? null,
    status: j.status,
    attempts: j.attempts,
    max_attempts: j.max_attempts,
    created_at: j.created_at,
    started_at: j.started_at,
    completed_at: j.completed_at,
    last_error: j.last_error,
  }));

  return NextResponse.json({ ok: true, jobs });
}
