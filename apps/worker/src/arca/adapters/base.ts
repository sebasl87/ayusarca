import axios, { type AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { ArcaSessionExpiredError } from "@siradig/shared/errors";
import type { ArcaSessionCookie } from "../login";
import { logger } from "../../lib/logger";

export abstract class ArcaFormAdapter<Input> {
  protected http: AxiosInstance;

  constructor(jsessionid: string, extraCookies: ArcaSessionCookie[] = []) {
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
    this.http = wrapper(
      axios.create({
        jar,
        baseURL: "https://serviciosjava2.afip.gob.ar",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://serviciosjava2.afip.gob.ar/radig/jsp/verMenuDeducciones.do",
          Origin: "https://serviciosjava2.afip.gob.ar",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 15000,
        validateStatus: () => true,
      })
    );
  }

  protected checkStatus(status: number, body: string) {
    if (status === 403 || body.includes("login.xhtml") || body.includes("contribuyente_/login")) {
      throw new ArcaSessionExpiredError(`arca_session_expired_${status}`);
    }
  }

  // GET the specific form page before POSTing — initialises server-side JSP session
  // state and detects expired sessions early. Throws ArcaSessionExpiredError if the
  // page redirects to login (so the job retries with a fresh login).
  protected async warmUpSession(formUrl: string): Promise<void> {
    const res = await this.http.get(formUrl).catch(() => null);
    if (!res) return;
    const body = String(res.data ?? "");
    logger.debug({ formUrl, status: res.status, bodySnippet: body.slice(0, 500) }, "warmup_response");
    this.checkStatus(res.status, body);
  }

  abstract guardar(
    data: Input
  ): Promise<{ success: boolean; arcaId?: string; error?: string }>;
}
