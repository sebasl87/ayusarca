import { chromium, type Browser } from "playwright";

import { ArcaCaptchaError, ArcaLoginError } from "@siradig/shared/errors";

export type ArcaLoginResult = {
  jsessionid: string;
  expiresAt: Date;
};

export async function loginToArca(cuit: string, claveFiscal: string) {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto("https://auth.afip.gob.ar/contribuyente_/login.xhtml");
    await page.fill("#F1\\:username", cuit);
    await page.click("#F1\\:btnSiguiente");
    await page.waitForSelector("#F1\\:password, #F1\\:captcha", { timeout: 10000 });

    const captcha = await page.$("#F1\\:captcha");
    if (captcha) throw new ArcaCaptchaError("captcha_required");

    await page.fill("#F1\\:password", claveFiscal);
    await page.click("#F1\\:btnIngresar");

    try {
      await page.waitForURL(/portalcf\.cloud\.afip\.gob\.ar/, { timeout: 15000 });
    } catch {
      const errorEl = await page.$(".errMsg, .errorMessage, [class*='error']");
      const msg = errorEl ? (await errorEl.textContent())?.trim() : null;
      throw new ArcaLoginError(msg ?? "invalid_credentials");
    }

    await page.goto(
      "https://serviciosjava2.afip.gob.ar/radig/jsp/verMenuEmpleado.do"
    );
    await page.waitForSelector("#formulario, .menuPrincipal", { timeout: 15000 });

    const cookies = await context.cookies("https://serviciosjava2.afip.gob.ar");
    const jsessionid = cookies.find((c) => c.name === "JSESSIONID")?.value;
    if (!jsessionid) throw new ArcaLoginError("jsessionid_missing");

    return { jsessionid, expiresAt: new Date(Date.now() + 20 * 60 * 1000) };
  } finally {
    await browser?.close();
  }
}
