import { NextResponse } from "next/server";

export const maxDuration = 90;

import type { Job } from "bullmq";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getQueue } from "@/lib/queue/bullmq";

export async function POST() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data: cred, error: credError } = await supabase
    .from("arca_credentials")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (credError) {
    return NextResponse.json({ ok: false, error: credError.message }, { status: 500 });
  }
  if (!cred) {
    return NextResponse.json({ ok: false, error: "missing_credentials" }, { status: 400 });
  }

  let job: Job<{ userId: string }, unknown, string> | null = null;
  try {
    const queue = getQueue("arca-test-credentials");
    job = await queue.add(
      "test",
      { userId: user.id },
      {
        jobId: `test-credentials_${user.id}_${Date.now()}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 50,
        removeOnFail: 50,
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "queue_error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  // Upstash Redis no soporta pub/sub persistente — polling con HGET en vez de waitUntilFinished
  try {
    if (!job) throw new Error("queue_error");
    const queue = getQueue("arca-test-credentials");
    const TIMEOUT = 80_000;
    const INTERVAL = 2_000;
    const deadline = Date.now() + TIMEOUT;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, INTERVAL));
      const current = await queue.getJob(job.id!);
      if (!current) break;
      const state = await current.getState();
      if (state === "completed") {
        return NextResponse.json({ ok: true, result: current.returnvalue });
      }
      if (state === "failed") {
        return NextResponse.json(
          { ok: false, error: current.failedReason ?? "job_failed" },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ ok: false, error: "timeout_waiting_for_job" }, { status: 504 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
