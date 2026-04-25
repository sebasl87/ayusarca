import { chromium, type Browser, type Page, type BrowserContext } from "playwright";

import { ArcaCaptchaError, ArcaLoginError } from "@siradig/shared/errors";

export type ArcaLoginResult = {
  jsessionid: string;
  expiresAt: Date;
};

const HEADLESS = process.env.ARCA_HEADLESS !== "false";

async function closeBrowserSafe(browser: Browser) {
  await Promise.race([
    browser.close().catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, 8000)),
  ]);
  try {
    const proc = (browser as unknown as { process?: () => { kill: (signal: string) => void } | null })
      .process?.();
    proc?.kill("SIGKILL");
  } catch {}
}

export async function loginToArca(cuit: string, claveFiscal: string) {
  let browser: Browser | null = null;
  try {
    process.stderr.write("[login] step:1 launching browser\n");
    browser = await chromium.launch({ headless: HEADLESS });
    const context: BrowserContext = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    });
    let page: Page = await context.newPage();

    process.stderr.write("[login] step:2 navigating to auth.afip.gob.ar\n");
    await page.goto("https://auth.afip.gob.ar/contribuyente_/login.xhtml");
    await page.fill("#F1\\:username", cuit);
    await page.click("#F1\\:btnSiguiente");
    await page.waitForSelector("#F1\\:password", { state: "visible", timeout: 10000 });

    const captchaVisible = await page.isVisible(
      "img[id*='captcha'], .captcha, [class*='captcha']:not(input[type='hidden'])"
    );
    if (captchaVisible) throw new ArcaCaptchaError("captcha_required");

    process.stderr.write("[login] step:3 filling password\n");
    await page.fill("#F1\\:password", claveFiscal);
    await page.click("#F1\\:btnIngresar");

    process.stderr.write("[login] step:4 waiting for portal redirect\n");
    await page.waitForURL(/portalcf\.cloud\.afip\.gob\.ar/, { timeout: 15000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    process.stderr.write(`[login] step:5 on portal URL: ${page.url()}\n`);

    const siradgEl = page.getByText(/SiRADIG|F572|RADIG/i).first();
    const count = await siradgEl.count();
    process.stderr.write(`[login] step:6 SiRADIG elements: ${count}\n`);

    if (count > 0) {
      // Listen for any new tabs opened by SiRADIG click
      const newPagePromise = context.waitForEvent("page", { timeout: 6000 }).catch(() => null);
      await siradgEl.click();
      process.stderr.write("[login] step:7 SiRADIG clicked\n");
      const newTab = await newPagePromise;

      if (newTab) {
        process.stderr.write("[login] step:8 new tab detected\n");
        // Wait for the new tab to start loading
        await newTab.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
        page = newTab;
        process.stderr.write(`[login] step:8b new tab URL: ${page.url()}\n`);
      }

      process.stderr.write("[login] step:9 waiting for serviciosjava2 URL\n");
      await page.waitForURL(/serviciosjava2\.afip\.gob\.ar/, { timeout: 25000 });
      process.stderr.write(`[login] step:10 on serviciosjava2 URL: ${page.url()}\n`);
    } else {
      process.stderr.write("[login] step:7 no SiRADIG element — direct navigation fallback\n");
      await page.goto("https://serviciosjava2.afip.gob.ar/radig/jsp/verMenuEmpleado.do");
    }

    // Handle "Seleccione la Persona" intermediate screen
    const currentUrl = page.url();
    process.stderr.write(`[login] step:11 checking for persona screen — URL: ${currentUrl}\n`);

    if (currentUrl.includes("menu_sel_empresa")) {
      process.stderr.write("[login] step:12 persona selection screen detected\n");
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});

      // Log the HTML to identify the exact element type
      const pageHtml = await page.evaluate(() => document.body?.innerHTML?.slice(0, 2000) ?? "").catch(() => "");
      process.stderr.write(`[login] step:12a page HTML snippet: ${pageHtml}\n`);

      const PERSONA_SELECTORS = [
        "table a",
        ".contenido a",
        "a[href*='verMenu']",
        "a[href*='empresa']",
        "input[type='submit']",
        "button[type='submit']",
        "button",
      ];

      const foundSelector = await page.evaluate((selectors: string[]) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) return sel;
        }
        return null;
      }, PERSONA_SELECTORS).catch(() => null);

      process.stderr.write(`[login] step:12b foundSelector: ${foundSelector}\n`);

      if (foundSelector) {
        const newTabPromise = context.waitForEvent("page", { timeout: 5000 }).catch(() => null);

        // Usar el locator nativo de Playwright — maneja eventos y navegación correctamente
        await Promise.all([
          page
            .waitForURL((url) => !url.toString().includes("menu_sel_empresa"), { timeout: 15000 })
            .catch(() => {}),
          page.locator(foundSelector).first().click({ timeout: 10000 }),
        ]);
        process.stderr.write(`[login] step:13 persona clicked — URL now: ${page.url()}\n`);

        const newTab = await newTabPromise;
        if (newTab) {
          process.stderr.write("[login] step:13b persona opened new tab\n");
          await newTab.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
          page = newTab;
        }
        process.stderr.write(`[login] step:14 after persona click — URL: ${page.url()}\n`);
      }
    }

    // Final wait — make sure the page is stable
    process.stderr.write("[login] step:15 final waitForLoadState\n");
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
    process.stderr.write(`[login] step:16 final URL: ${page.url()}\n`);

    // JSESSIONID: buscar en cookies (todos los dominios) y en URL
    const allCookies = await context.cookies();
    process.stderr.write(`[login] step:16b all cookies: ${JSON.stringify(allCookies.map((c) => ({ name: c.name, domain: c.domain, path: c.path })))}\n`);

    let jsessionid = allCookies.find((c) => c.name === "JSESSIONID")?.value;
    if (!jsessionid) {
      const match = page.url().match(/jsessionid=([A-F0-9.]+)/i);
      if (match) jsessionid = match[1];
    }
    // Fallback: extraer del HTML embebido (algunos JSP Java lo emiten en el <form> o JS)
    if (!jsessionid) {
      jsessionid = await page.evaluate(() => {
        const m = document.body?.innerHTML?.match(/jsessionid=([A-F0-9]+)/i);
        return m ? m[1] : null;
      }).catch(() => null) ?? undefined;
    }

    process.stderr.write(`[login] step:17 JSESSIONID: ${jsessionid ? "OK" : "NOT FOUND"} | URL: ${page.url()}\n`);
    if (!jsessionid) throw new ArcaLoginError("jsessionid_missing");

    process.stderr.write("[login] step:18 returning — closing browser\n");
    return { jsessionid, expiresAt: new Date(Date.now() + 20 * 60 * 1000) };
  } catch (e) {
    if (e instanceof ArcaCaptchaError || e instanceof ArcaLoginError) throw e;
    throw new ArcaLoginError(`arca_login_failed: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    if (browser) {
      process.stderr.write("[login] finally: closing browser\n");
      await closeBrowserSafe(browser);
      process.stderr.write("[login] finally: browser closed\n");
    }
  }
}
