import { createDecipheriv, scryptSync } from "node:crypto";

import { env } from "../env";

export type EncryptedCredential = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export function decryptCredential(enc: EncryptedCredential, userId: string) {
  const key = scryptSync(Buffer.from(env.CREDENTIALS_MASTER_KEY, "hex"), Buffer.from(userId), 32);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(enc.iv, "base64"));
  decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

