import { chromium, type Browser } from "playwright";

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
    await page.waitForSelector("#F1\\:password");

    const captcha = await page.$("#F1\\:captcha");
    if (captcha) throw new Error("captcha_required");

    await page.fill("#F1\\:password", claveFiscal);
    await page.click("#F1\\:btnIngresar");
    await page.waitForURL(/portalcf\.cloud\.afip\.gob\.ar/, { timeout: 15000 });

    await page.goto(
      "https://serviciosjava2.afip.gob.ar/radig/jsp/verMenuEmpleado.do"
    );
    await page.waitForSelector("#formulario, .menuPrincipal", {
      timeout: 15000,
    });

    const cookies = await context.cookies("https://serviciosjava2.afip.gob.ar");
    const jsessionid = cookies.find((c) => c.name === "JSESSIONID")?.value;
    if (!jsessionid) throw new Error("jsessionid_missing");

    return { jsessionid, expiresAt: new Date(Date.now() + 20 * 60 * 1000) };
  } finally {
    await browser?.close();
  }
}
