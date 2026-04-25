import axios, { type AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { ArcaSessionExpiredError } from "@siradig/shared/errors";
import type { ArcaSessionCookie } from "../login";

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
          Referer:
            "https://serviciosjava2.afip.gob.ar/radig/jsp/verMenuDeducciones.do",
          Origin: "https://serviciosjava2.afip.gob.ar",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 15000,
        // No lanzar error en 4xx/5xx — lo manejamos nosotros
        validateStatus: () => true,
      })
    );
  }

  protected checkStatus(status: number, body: string) {
    if (status === 403 || body.includes("login.xhtml") || body.includes("contribuyente_/login")) {
      throw new ArcaSessionExpiredError(`arca_session_expired_${status}`);
    }
  }

  // Navegar al menú de deducciones antes del POST para inicializar el estado
  // de sesión Java — sin esto ARCA devuelve 403 en los endpoints de guardar
  protected async warmUpSession(): Promise<void> {
    await this.http.get("/radig/jsp/verMenuDeducciones.do").catch(() => {});
  }

  abstract guardar(
    data: Input
  ): Promise<{ success: boolean; arcaId?: string; error?: string }>;
}
