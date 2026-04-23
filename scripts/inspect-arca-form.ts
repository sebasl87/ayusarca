import { chromium } from "playwright";

function getArg(flag: string) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const value = process.argv[idx + 1];
  if (!value) return null;
  return value;
}

const pathArg = getArg("--path") ?? process.env.ARCA_FORM_PATH ?? null;
if (!pathArg) {
  throw new Error("missing_path");
}

const cuit = process.env.ARCA_CUIT;
const claveFiscal = process.env.ARCA_CLAVE_FISCAL;
if (!cuit || !claveFiscal) {
  throw new Error("missing_arca_credentials");
}

const targetUrl = pathArg.startsWith("http")
  ? pathArg
  : `https://serviciosjava2.afip.gob.ar${pathArg.startsWith("/") ? "" : "/"}${pathArg}`;

const browser = await chromium.launch({ headless: true });
try {
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

  await page.goto("https://serviciosjava2.afip.gob.ar/radig/jsp/verMenuEmpleado.do");
  await page.waitForSelector("#formulario, form", { timeout: 15000 });

  await page.goto(targetUrl);
  await page.waitForSelector("#formulario, form", { timeout: 15000 });

  const schema = await page.evaluate(() => {
    const formEl =
      (document.querySelector("#formulario") as HTMLFormElement | null) ??
      (document.querySelector("form") as HTMLFormElement | null);
    if (!formEl) throw new Error("form_not_found");

    const fields = Array.from(formEl.querySelectorAll("input, select, textarea")).map((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === "select") {
        const select = el as HTMLSelectElement;
        return {
          tag,
          name: select.name ?? null,
          id: select.id ?? null,
          value: select.value ?? null,
          options: Array.from(select.options).map((o) => ({ value: o.value, label: o.label })),
          disabled: select.disabled,
        };
      }
      if (tag === "textarea") {
        const ta = el as HTMLTextAreaElement;
        return {
          tag,
          name: ta.name ?? null,
          id: ta.id ?? null,
          value: ta.value ?? null,
          disabled: ta.disabled,
        };
      }
      const input = el as HTMLInputElement;
      return {
        tag,
        type: input.type ?? null,
        name: input.name ?? null,
        id: input.id ?? null,
        value: input.value ?? null,
        checked: input.type === "checkbox" || input.type === "radio" ? input.checked : null,
        disabled: input.disabled,
      };
    });

    return {
      url: window.location.href,
      action: formEl.action ?? null,
      method: formEl.method ?? null,
      fields,
    };
  });

  process.stdout.write(`${JSON.stringify(schema, null, 2)}\n`);
} finally {
  await browser.close();
}
