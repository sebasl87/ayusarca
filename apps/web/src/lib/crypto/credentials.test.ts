import { describe, expect, it, beforeEach } from "vitest";

const MASTER_KEY = "a".repeat(64);
const USER_A = "00000000-0000-0000-0000-000000000001";
const USER_B = "00000000-0000-0000-0000-000000000002";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key";
  process.env.CREDENTIALS_MASTER_KEY = MASTER_KEY;
});

describe("web credentials crypto", () => {
  it("roundtrip: encrypt then decrypt returns same plaintext", async () => {
    const { encryptCredential, decryptCredential } = await import("./credentials");
    const enc = encryptCredential("clave_fiscal_secreta", USER_A);
    expect(decryptCredential(enc, USER_A)).toBe("clave_fiscal_secreta");
  });

  it("IV is different on each call (non-deterministic)", async () => {
    const { encryptCredential } = await import("./credentials");
    const enc1 = encryptCredential("mismo_texto", USER_A);
    const enc2 = encryptCredential("mismo_texto", USER_A);
    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });

  it("fails to decrypt when userId differs (wrong salt)", async () => {
    const { encryptCredential, decryptCredential } = await import("./credentials");
    const enc = encryptCredential("secreta", USER_A);
    expect(() => decryptCredential(enc, USER_B)).toThrow();
  });

  it("fails to decrypt with tampered ciphertext", async () => {
    const { encryptCredential, decryptCredential } = await import("./credentials");
    const enc = encryptCredential("secreta", USER_A);
    const tampered = { ...enc, ciphertext: Buffer.from("corrupted").toString("base64") };
    expect(() => decryptCredential(tampered, USER_A)).toThrow();
  });
});
