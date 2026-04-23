import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

let cachedClientEnv: z.infer<typeof clientEnvSchema> | null = null;
export function getClientEnv() {
  if (cachedClientEnv) return cachedClientEnv;
  cachedClientEnv = clientEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  return cachedClientEnv;
}

const serverEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  CREDENTIALS_MASTER_KEY: z.string().min(64).optional(),
  LOG_LEVEL: z.string().min(1).optional(),
});

let cachedServerEnv: z.infer<typeof serverEnvSchema> | null = null;
export function getServerEnv() {
  if (cachedServerEnv) return cachedServerEnv;
  cachedServerEnv = serverEnvSchema.parse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    REDIS_URL: process.env.REDIS_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CREDENTIALS_MASTER_KEY: process.env.CREDENTIALS_MASTER_KEY,
    LOG_LEVEL: process.env.LOG_LEVEL,
  });
  return cachedServerEnv;
}
