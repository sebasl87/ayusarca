import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

import { env } from "../env";

export type EncryptedCredential = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export function encryptCredential(plaintext: string, userId: string): EncryptedCredential {
  const key = scryptSync(Buffer.from(env.CREDENTIALS_MASTER_KEY, "hex"), Buffer.from(userId), 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptCredential(enc: EncryptedCredential, userId: string) {
  const key = scryptSync(Buffer.from(env.CREDENTIALS_MASTER_KEY, "hex"), Buffer.from(userId), 32);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(enc.iv, "base64"));
  decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
