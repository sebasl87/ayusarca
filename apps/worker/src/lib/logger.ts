import pino from "pino";

import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "CREDENTIALS_MASTER_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "*.CREDENTIALS_MASTER_KEY",
      "*.SUPABASE_SERVICE_ROLE_KEY",
      "*.claveFiscal",
      "*.clave_fiscal_encrypted",
      "*.clave_fiscal_iv",
      "*.clave_fiscal_tag",
      "*.last_session_cookie",
      "headers.authorization",
      "headers.cookie",
    ],
    remove: true,
  },
});
