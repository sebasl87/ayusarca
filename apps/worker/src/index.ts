import { Queue, Worker } from "bullmq";

import { cargarDeduccion } from "./processors/cargarDeduccion";
import { testCredentials } from "./processors/testCredentials";
import { keepaliveCachedSessions } from "./arca/session";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { redisConnection } from "./lib/redis";
import { ArcaRateLimitError } from "@siradig/shared/errors";

const cargarWorker = new Worker("cargar-deduccion", cargarDeduccion, {
  connection: redisConnection,
  concurrency: env.WORKER_CONCURRENCY,
  limiter: {
    max: 1,
    duration: env.ARCA_RATE_LIMIT_MS,
  },
});

const testWorker = new Worker("arca-test-credentials", testCredentials, {
  connection: redisConnection,
  concurrency: 1,
  limiter: {
    max: 1,
    duration: env.ARCA_RATE_LIMIT_MS,
  },
});

cargarWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "cargar-deduccion_failed");
});

testWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "arca-test-credentials_failed");
});

const queue = new Queue("cargar-deduccion", { connection: redisConnection });

const KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000;
const timer = setInterval(async () => {
  try {
    const counts = await queue.getJobCounts("wait", "active", "delayed");
    const total = (counts.wait ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
    if (total === 0) return;
    await keepaliveCachedSessions();
  } catch (e) {
    logger.error({ err: e }, "arca_keepalive_failed");
    if (e instanceof ArcaRateLimitError) {
      await cargarWorker.pause(true);
      await testWorker.pause(true);
      logger.error("workers_paused_rate_limit");
    }
  }
}, KEEPALIVE_INTERVAL_MS);
timer.unref();
