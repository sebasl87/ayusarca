import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, basename } from "node:path";

function getArg(flag: string) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const value = process.argv[idx + 1];
  if (!value) return null;
  return value;
}

const pathArg = getArg("--path") ?? process.env.ARCA_FORM_PATH ?? null;
if (!pathArg) throw new Error("missing_path: pasar --path /radig/jsp/verGastosEducacion.do");

const cuit = process.env.ARCA_CUIT;
const claveFiscal = process.env.ARCA_CLAVE_FISCAL;
if (!cuit || !claveFiscal) throw new Error("missing_arca_credentials: definir ARCA_CUIT y ARCA_CLAVE_FISCAL");

const targetUrl = pathArg.startsWith("http")
  ? pathArg
  : `https://serviciosjava2.afip.gob.ar${pathArg.startsWith("/") ? "" : "/"}${pathArg}`;

const outDir = resolve(process.cwd(), "inspected");
const slug = basename(pathArg).replace(/\.do$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
const outFile = resolve(outDir, `${slug}.json`);

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  process.stderr.write("Iniciando login ARCA…\n");
  await page.goto("https://auth.afip.gob.ar/contribuyente_/login.xhtml");
  await page.fill("#F1\\:username", cuit);
  await page.click("#F1\\:btnSiguiente");
  await page.waitForSelector("#F1\\:password, #F1\\:captcha", { timeout: 10000 });

  const captcha = await page.$("#F1\\:captcha");
  if (captcha) throw new Error("captcha_required: no se puede continuar en modo headless");

  await page.fill("#F1\\:password", claveFiscal);
  await page.click("#F1\\:btnIngresar");
  await page.waitForURL(/portalcf\.cloud\.afip\.gob\.ar/, { timeout: 15000 });

  process.stderr.write("Login OK. Navegando a SiRADIG…\n");
  await page.goto("https://serviciosjava2.afip.gob.ar/radig/jsp/verMenuEmpleado.do");
  await page.waitForSelector("#formulario, form", { timeout: 15000 });

  process.stderr.write(`Navegando a ${targetUrl}…\n`);
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
        const s = el as HTMLSelectElement;
        return { tag, name: s.name, id: s.id, value: s.value, disabled: s.disabled,
          options: Array.from(s.options).map((o) => ({ value: o.value, label: o.label })) };
      }
      if (tag === "textarea") {
        const ta = el as HTMLTextAreaElement;
        return { tag, name: ta.name, id: ta.id, value: ta.value, disabled: ta.disabled };
      }
      const input = el as HTMLInputElement;
      return { tag, type: input.type, name: input.name, id: input.id, value: input.value,
        checked: input.type === "checkbox" || input.type === "radio" ? input.checked : null,
        disabled: input.disabled };
    });

    return { url: window.location.href, action: formEl.action, method: formEl.method, fields };
  });

  const output = JSON.stringify(schema, null, 2);
  process.stdout.write(`${output}\n`);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, output, "utf8");
  process.stderr.write(`Guardado en ${outFile}\n`);
} finally {
  await browser.close();
}
