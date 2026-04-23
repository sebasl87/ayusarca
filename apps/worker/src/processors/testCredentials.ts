import type { Job } from "bullmq";

import { loginToArca } from "../arca/login";
import { decryptCredential } from "../lib/crypto/credentials";
import { supabaseAdmin } from "../lib/supabase";

export type TestCredentialsJobData = {
  userId: string;
};

export async function testCredentials(job: Job<TestCredentialsJobData>) {
  const { userId } = job.data;
  const { data, error } = await supabaseAdmin
    .from("arca_credentials")
    .select("cuit, clave_fiscal_encrypted, clave_fiscal_iv, clave_fiscal_tag")
    .eq("user_id", userId)
    .single();

  if (error) throw new Error(error.message);

  const claveFiscal = decryptCredential(
    {
      ciphertext: data.clave_fiscal_encrypted,
      iv: data.clave_fiscal_iv,
      tag: data.clave_fiscal_tag,
    },
    userId
  );

  await loginToArca(data.cuit, claveFiscal);

  await supabaseAdmin
    .from("arca_credentials")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", userId);

  return { ok: true };
}

