import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

import { ArcaRateLimitError, ArcaSessionExpiredError } from "@siradig/shared/errors";
import type { ArcaSessionCookie } from "./login";

function createClient(jsessionid: string, extraCookies: ArcaSessionCookie[] = []) {
  const jar = new CookieJar();
  jar.setCookieSync(
    `JSESSIONID=${jsessionid}; Path=/radig; Secure; HttpOnly`,
    "https://serviciosjava2.afip.gob.ar"
  );
  for (const c of extraCookies) {
    try {
      jar.setCookieSync(`${c.name}=${c.value}; Path=/radig`, "https://serviciosjava2.afip.gob.ar");
    } catch {}
  }

  return wrapper(
    axios.create({
      jar,
      baseURL: "https://serviciosjava2.afip.gob.ar",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://serviciosjava2.afip.gob.ar/radig/jsp/verMenuEmpleado.do",
      },
      timeout: 15000,
      validateStatus: () => true,
    })
  );
}

export async function arcaKeepalive(jsessionid: string, extraCookies: ArcaSessionCookie[] = []) {
  const http = createClient(jsessionid, extraCookies);
  const res = await http.get(`/radig/jsp/ajax.do?f=keepalive&_=${Date.now()}`);

  if (res.status === 429) {
    throw new ArcaRateLimitError(`arca_keepalive_${res.status}`);
  }

  const body = String(res.data ?? "");
  if (res.status >= 400) throw new ArcaSessionExpiredError(`arca_keepalive_${res.status}`);
  if (body.includes("login.xhtml") || body.includes("contribuyente_/login")) {
    throw new ArcaSessionExpiredError("arca_session_expired");
  }
}
