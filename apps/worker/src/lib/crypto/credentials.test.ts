import { describe, expect, it } from "vitest";

function setEnv() {
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_key";
  process.env.CREDENTIALS_MASTER_KEY =
    "0000000000000000000000000000000000000000000000000000000000000000";
}

describe("credentials crypto", () => {
  it("roundtrips per user", async () => {
    setEnv();
    const { encryptCredential, decryptCredential } = await import("./credentials");
    const userId = "00000000-0000-0000-0000-000000000000";
    const enc = encryptCredential("secret", userId);
    const dec = decryptCredential(enc, userId);
    expect(dec).toBe("secret");
  });

  it("fails for different user", async () => {
    setEnv();
    const { encryptCredential, decryptCredential } = await import("./credentials");
    const enc = encryptCredential("secret", "00000000-0000-0000-0000-000000000000");
    expect(() => decryptCredential(enc, "11111111-1111-1111-1111-111111111111")).toThrow();
  });
});
