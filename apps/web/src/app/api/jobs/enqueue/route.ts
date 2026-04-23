import { NextResponse } from "next/server";
import { z } from "zod";

import { getQueue } from "@/lib/queue/bullmq";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  facturaIds: z.array(z.string().min(1)).min(1),
});

const MAX_ATTEMPTS = 5;

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
  const { facturaIds } = bodySchema.parse(json);

  const { data: facturas, error: facturasError } = await supabase
    .from("facturas")
    .select("id, status")
    .in("id", facturaIds)
    .eq("user_id", user.id);

  if (facturasError) {
    return NextResponse.json({ ok: false, error: facturasError.message }, { status: 500 });
  }

  const byId = new Map((facturas ?? []).map((f) => [f.id as string, f]));
  for (const id of facturaIds) {
    const f = byId.get(id);
    if (!f) {
      return NextResponse.json({ ok: false, error: "factura_not_found" }, { status: 404 });
    }
    if (!["extracted", "ready", "failed"].includes(String(f.status))) {
      return NextResponse.json({ ok: false, error: "factura_not_ready" }, { status: 400 });
    }
  }

  let queue: ReturnType<typeof getQueue>;
  try {
    queue = getQueue("cargar-deduccion");
  } catch (e) {
    const message = e instanceof Error ? e.message : "redis_not_configured";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
  const jobs: Array<{ facturaId: string; loadJobId: string; bullmqJobId: string }> = [];

  for (const facturaId of facturaIds) {
    const { data: loadJob, error: loadJobError } = await supabase
      .from("load_jobs")
      .insert({
        user_id: user.id,
        factura_id: facturaId,
        status: "queued",
        max_attempts: MAX_ATTEMPTS,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (loadJobError || !loadJob) {
      return NextResponse.json(
        { ok: false, error: loadJobError?.message ?? "load_job_insert_failed" },
        { status: 500 }
      );
    }

    const job = await queue.add(
      "cargar",
      { userId: user.id, facturaId, loadJobId: loadJob.id },
      {
        jobId: loadJob.id,
        attempts: MAX_ATTEMPTS,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      }
    );

    await supabase
      .from("load_jobs")
      .update({ bullmq_job_id: String(job.id) })
      .eq("id", loadJob.id)
      .eq("user_id", user.id);

    await supabase
      .from("facturas")
      .update({ status: "queued", updated_at: new Date().toISOString() })
      .eq("id", facturaId)
      .eq("user_id", user.id);

    jobs.push({ facturaId, loadJobId: loadJob.id, bullmqJobId: String(job.id) });
  }

  return NextResponse.json({ ok: true, jobs });
}
