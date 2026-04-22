import { z } from "zod";

const envSchema = z.object({
  REDIS_URL: z.string().min(1),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(2),
  ARCA_RATE_LIMIT_MS: z.coerce.number().int().min(200).default(800),
});

export const env = envSchema.parse({
  REDIS_URL: process.env.REDIS_URL,
  WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY,
  ARCA_RATE_LIMIT_MS: process.env.ARCA_RATE_LIMIT_MS,
});
