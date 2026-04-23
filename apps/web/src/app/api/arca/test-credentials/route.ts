import { NextResponse } from "next/server";

import { QueueEvents } from "bullmq";
import type { Job } from "bullmq";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getQueue, getRedisConnection } from "@/lib/queue/bullmq";

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
        jobId: `test-credentials:${user.id}`,
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

  let queueEvents: QueueEvents | null = null;
  try {
    queueEvents = new QueueEvents("arca-test-credentials", {
      connection: getRedisConnection(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "redis_not_configured";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  try {
    if (!job) throw new Error("queue_error");
    const result = await job.waitUntilFinished(queueEvents, 25000);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await queueEvents?.close();
  }
}
