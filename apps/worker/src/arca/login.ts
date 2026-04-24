import { chromium, type Browser, type Page, type BrowserContext } from "playwright";

import { ArcaCaptchaError, ArcaLoginError } from "@siradig/shared/errors";

export type ArcaLoginResult = {
  jsessionid: string;
  expiresAt: Date;
};

const HEADLESS = process.env.ARCA_HEADLESS !== "false";

export async function loginToArca(cuit: string, claveFiscal: string) {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: HEADLESS });
    const context: BrowserContext = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    });
    let page: Page = await context.newPage();

    // Paso 1: login en auth.afip.gob.ar
    await page.goto("https://auth.afip.gob.ar/contribuyente_/login.xhtml");
    await page.fill("#F1\\:username", cuit);
    await page.click("#F1\\:btnSiguiente");
    await page.waitForSelector("#F1\\:password", { state: "visible", timeout: 10000 });

    const captchaVisible = await page.isVisible(
      "img[id*='captcha'], .captcha, [class*='captcha']:not(input[type='hidden'])"
    );
    if (captchaVisible) throw new ArcaCaptchaError("captcha_required");

    await page.fill("#F1\\:password", claveFiscal);
    await page.click("#F1\\:btnIngresar");

    // Paso 2: esperar redirect al portal
    await page.waitForURL(/portalcf\.cloud\.afip\.gob\.ar/, { timeout: 15000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    // Loguear todos los links del portal para debug
    const allLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a")).map((a) => ({
        text: (a as HTMLAnchorElement).textContent?.trim().slice(0, 80),
        href: (a as HTMLAnchorElement).href,
        title: (a as HTMLAnchorElement).title,
      }))
    );
    process.stderr.write(`[login] Portal URL: ${page.url()} | Links: ${allLinks.length}\n`);
    for (const l of allLinks) {
      if (l.href || l.title || l.text) {
        process.stderr.write(`  "${l.text}" href=${l.href} title=${l.title}\n`);
      }
    }

    // Paso 3: buscar y clickear SiRADIG para disparar SSO
    const siradgEl = page.getByText(/SiRADIG|F572|RADIG/i).first();
    const count = await siradgEl.count();
    process.stderr.write(`[login] Elementos con texto SiRADIG/F572/RADIG: ${count}\n`);

    if (count > 0) {
      // SiRADIG puede abrir una nueva pestaña
      const newPagePromise = context.waitForEvent("page", { timeout: 4000 }).catch(() => null);
      await siradgEl.click();
      const newTab = await newPagePromise;

      if (newTab) {
        process.stderr.write("[login] SiRADIG abrió nueva pestaña\n");
        await newTab.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
        page = newTab;
      }

      await page.waitForURL(/serviciosjava2\.afip\.gob\.ar/, { timeout: 20000 });
    } else {
      process.stderr.write(`[login] No se encontró SiRADIG — fallback a navegación directa\n`);
      await page.goto("https://serviciosjava2.afip.gob.ar/radig/jsp/verMenuEmpleado.do");
    }

    // Paso 4: pantalla intermedia "Seleccione la Persona a representar"
    if (page.url().includes("menu_sel_empresa")) {
      process.stderr.write("[login] Pantalla de selección de persona — haciendo click en la primera opción\n");
      const personaLink = page.locator("table a, .contenido a, a[href*='verMenu'], a[href*='empresa']").first();
      if (await personaLink.count() > 0) {
        await personaLink.click();
        await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
      }
    }

    // Esperar que la página cargue (no asumimos selectores específicos del menú)
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 });

    // JSESSIONID puede estar en cookies o embebido en la URL (Java URL rewriting)
    const cookies = await context.cookies("https://serviciosjava2.afip.gob.ar");
    let jsessionid = cookies.find((c) => c.name === "JSESSIONID")?.value;
    if (!jsessionid) {
      const match = page.url().match(/jsessionid=([A-F0-9]+)/i);
      if (match) jsessionid = match[1];
    }
    process.stderr.write(`[login] JSESSIONID: ${jsessionid ? "OK" : "NOT FOUND"} | URL: ${page.url()}\n`);
    if (!jsessionid) throw new ArcaLoginError("jsessionid_missing");

    return { jsessionid, expiresAt: new Date(Date.now() + 20 * 60 * 1000) };
  } catch (e) {
    if (e instanceof ArcaCaptchaError || e instanceof ArcaLoginError) throw e;
    throw new ArcaLoginError(`arca_login_failed: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await browser?.close();
  }
}
