import axios, { type AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

export abstract class ArcaFormAdapter<Input> {
  protected http: AxiosInstance;

  constructor(jsessionid: string) {
    const jar = new CookieJar();
    jar.setCookieSync(
      `JSESSIONID=${jsessionid}; Path=/radig; Secure; HttpOnly`,
      "https://serviciosjava2.afip.gob.ar"
    );
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
      })
    );
  }

  abstract guardar(
    data: Input
  ): Promise<{ success: boolean; arcaId?: string; error?: string }>;
}
