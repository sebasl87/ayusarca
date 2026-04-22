import { Worker } from "bullmq";

import { cargarDeduccion } from "./processors/cargarDeduccion";
import { env } from "./lib/env";
import { redisConnection } from "./lib/redis";

new Worker("cargar-deduccion", cargarDeduccion, {
  connection: redisConnection,
  concurrency: env.WORKER_CONCURRENCY,
  limiter: {
    max: 1,
    duration: env.ARCA_RATE_LIMIT_MS,
  },
});
