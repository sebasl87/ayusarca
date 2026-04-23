import pino from "pino";

import { getServerEnv } from "@/lib/env";

const env = getServerEnv();

export const logger = pino({
  level: env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "ANTHROPIC_API_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "CREDENTIALS_MASTER_KEY",
      "*.ANTHROPIC_API_KEY",
      "*.SUPABASE_SERVICE_ROLE_KEY",
      "*.CREDENTIALS_MASTER_KEY",
      "*.claveFiscal",
      "*.clave_fiscal_encrypted",
      "*.clave_fiscal_iv",
      "*.clave_fiscal_tag",
      "*.last_session_cookie",
    ],
    remove: true,
  },
});
