import { ArcaCaptchaError, ArcaLoginError, ArcaSessionExpiredError } from "@siradig/shared/errors";

import { loginToArca, type ArcaSessionCookie } from "./login";
import { arcaKeepalive } from "./keepalive";
import { decryptCredential, encryptCredential } from "../lib/crypto/credentials";
import { supabaseAdmin } from "../lib/supabase";

type CachedSession = {
  jsessionid: string;
  extraCookies: ArcaSessionCookie[];
  expiresAt: Date;
};

const sessionCache = new Map<string, CachedSession>();

function isValidSession(session: CachedSession) {
  return session.expiresAt.getTime() > Date.now() + 60_000;
}

function parseEncryptedCookie(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "ciphertext" in parsed &&
      "iv" in parsed &&
      "tag" in parsed
    ) {
      const e = parsed as { ciphertext: string; iv: string; tag: string };
      if (typeof e.ciphertext === "string" && typeof e.iv === "string" && typeof e.tag === "string") {
        return e;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function invalidateArcaSession(userId: string) {
  sessionCache.delete(userId);
  await supabaseAdmin
    .from("arca_credentials")
    .update({
      last_session_cookie: null,
      last_session_expires_at: new Date(0).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

export async function getArcaSession(params: { userId: string; cuit: string; claveFiscal: string }) {
  const cached = sessionCache.get(params.userId);
  if (cached && isValidSession(cached)) return cached;

  const { data: row } = await supabaseAdmin
    .from("arca_credentials")
    .select("last_session_cookie, last_session_expires_at")
    .eq("user_id", params.userId)
    .maybeSingle();

  const dbExpiresAt = row?.last_session_expires_at ? new Date(row.last_session_expires_at) : null;
  const encrypted = parseEncryptedCookie(row?.last_session_cookie ?? null);
  if (encrypted && dbExpiresAt && dbExpiresAt.getTime() > Date.now() + 60_000) {
    const jsessionid = decryptCredential(encrypted, params.userId);
    try {
      await arcaKeepalive(jsessionid);
      // DB path: no extraCookies stored — first 403 will invalidate and force re-login
      const session = { jsessionid, extraCookies: [], expiresAt: dbExpiresAt };
      sessionCache.set(params.userId, session);
      return session;
    } catch (e) {
      if (!(e instanceof ArcaSessionExpiredError)) throw e;
    }
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const login = await loginToArca(params.cuit, params.claveFiscal);
      const enc = encryptCredential(login.jsessionid, params.userId);
      await supabaseAdmin
        .from("arca_credentials")
        .update({
          last_used_at: new Date().toISOString(),
          last_session_cookie: JSON.stringify(enc),
          last_session_expires_at: login.expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", params.userId);

      const session = { jsessionid: login.jsessionid, extraCookies: login.extraCookies, expiresAt: login.expiresAt };
      sessionCache.set(params.userId, session);
      return session;
    } catch (e) {
      lastError = e;
      if (e instanceof ArcaCaptchaError || e instanceof ArcaLoginError) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }

  throw new ArcaLoginError("arca_login_failed", { cause: lastError });
}

export async function keepaliveCachedSessions() {
  const now = Date.now();
  for (const [userId, session] of sessionCache.entries()) {
    if (session.expiresAt.getTime() <= now) {
      sessionCache.delete(userId);
      continue;
    }
    try {
      await arcaKeepalive(session.jsessionid, session.extraCookies);
      const nextExpiresAt = new Date(Date.now() + 20 * 60 * 1000);
      session.expiresAt = nextExpiresAt;
      sessionCache.set(userId, session);
      await supabaseAdmin
        .from("arca_credentials")
        .update({ last_session_expires_at: nextExpiresAt.toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    } catch (e) {
      sessionCache.delete(userId);
      if (e instanceof ArcaSessionExpiredError) continue;
      throw e;
    }
  }
}
