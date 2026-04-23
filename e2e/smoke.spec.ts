import { test, expect } from "@playwright/test";

type Factura = {
  id: string;
  original_filename: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  extracted_cuit: string | null;
  extracted_razon_social: string | null;
  extracted_tipo_comprobante: string | null;
  extracted_punto_venta: string | null;
  extracted_numero: string | null;
  extracted_fecha_emision: string | null;
  extracted_monto_total: number | null;
  extracted_categoria_sugerida: string | null;
  edited_cuit: string | null;
  edited_razon_social: string | null;
  edited_tipo_comprobante: string | null;
  edited_punto_venta: string | null;
  edited_numero: string | null;
  edited_fecha_emision: string | null;
  edited_monto_total: number | null;
  edited_categoria: string | null;
  edited_mes_deduccion: string | null;
  edited_id_concepto: number | null;
  arca_deduccion_id: string | null;
  error_message: string | null;
};

test("flujo básico: upload → extract → edit → enqueue (mock)", async ({ page }) => {
  const facturas = new Map<string, Factura>();

  await page.route("**/api/facturas/upload", async (route) => {
    const id = "factura-1";
    const now = new Date().toISOString();
    facturas.set(id, {
      id,
      original_filename: "e2e.png",
      status: "uploaded",
      created_at: now,
      updated_at: now,
      extracted_cuit: null,
      extracted_razon_social: null,
      extracted_tipo_comprobante: null,
      extracted_punto_venta: null,
      extracted_numero: null,
      extracted_fecha_emision: null,
      extracted_monto_total: null,
      extracted_categoria_sugerida: null,
      edited_cuit: null,
      edited_razon_social: null,
      edited_tipo_comprobante: null,
      edited_punto_venta: null,
      edited_numero: null,
      edited_fecha_emision: null,
      edited_monto_total: null,
      edited_categoria: null,
      edited_mes_deduccion: null,
      edited_id_concepto: null,
      arca_deduccion_id: null,
      error_message: null,
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, facturas: [{ id }] }),
    });
  });

  await page.route("**/api/facturas/extract", async (route) => {
    const req = route.request();
    const body = req.postDataJSON() as { facturaId?: string } | null;
    const facturaId = body?.facturaId ?? "factura-1";
    const now = new Date().toISOString();
    const prev = facturas.get(facturaId);
    if (prev) {
      facturas.set(facturaId, {
        ...prev,
        status: "extracted",
        updated_at: now,
        extracted_cuit: "20123456789",
        extracted_razon_social: "ACME SA",
        extracted_tipo_comprobante: "A",
        extracted_punto_venta: "0001",
        extracted_numero: "00000001",
        extracted_fecha_emision: "2026-01-15",
        extracted_monto_total: 12345,
        extracted_categoria_sugerida: "indumentaria",
        error_message: null,
      });
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/facturas", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, facturas: Array.from(facturas.values()) }),
    });
  });

  await page.route(/.*\/api\/facturas\/[^/]+$/, async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    const url = new URL(route.request().url());
    const facturaId = url.pathname.split("/").pop() ?? "factura-1";
    const json = (route.request().postDataJSON() as { edited?: Record<string, unknown> }) ?? {};

    const prev = facturas.get(facturaId);
    if (prev) {
      const edited = (json.edited ?? {}) as Record<string, unknown>;
      facturas.set(facturaId, {
        ...prev,
        status: "ready",
        updated_at: new Date().toISOString(),
        edited_cuit: typeof edited.cuit === "string" ? edited.cuit : prev.edited_cuit,
        edited_razon_social:
          typeof edited.razonSocial === "string"
            ? edited.razonSocial
            : prev.edited_razon_social,
        edited_tipo_comprobante:
          typeof edited.tipoComprobante === "string"
            ? edited.tipoComprobante
            : prev.edited_tipo_comprobante,
        edited_punto_venta:
          typeof edited.puntoVenta === "string" ? edited.puntoVenta : prev.edited_punto_venta,
        edited_numero:
          typeof edited.numero === "string" ? edited.numero : prev.edited_numero,
        edited_fecha_emision:
          typeof edited.fechaEmision === "string"
            ? edited.fechaEmision
            : prev.edited_fecha_emision,
        edited_monto_total:
          typeof edited.montoTotal === "number"
            ? edited.montoTotal
            : prev.edited_monto_total,
        edited_categoria:
          typeof edited.categoria === "string" ? edited.categoria : prev.edited_categoria,
        edited_mes_deduccion:
          typeof edited.mesDeduccion === "string"
            ? edited.mesDeduccion
            : prev.edited_mes_deduccion,
        edited_id_concepto:
          typeof edited.idConcepto === "number"
            ? edited.idConcepto
            : prev.edited_id_concepto,
      });
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/jobs/enqueue", async (route) => {
    const now = new Date().toISOString();
    for (const [id, f] of facturas.entries()) {
      if (f.status === "ready" || f.status === "extracted") {
        facturas.set(id, { ...f, status: "queued", updated_at: now });
      }
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        jobs: [{ facturaId: "factura-1", loadJobId: "job-1", bullmqJobId: "1" }],
      }),
    });
  });

  await page.goto("/facturas/upload");
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c636000000200015e2b2c610000000049454e44ae426082", "hex"),
  });
  await page.getByRole("button", { name: "Subir y extraer" }).click();
  await page.waitForURL("**/facturas");

  const row = page.locator("tr", { hasText: "e2e.png" }).first();
  await expect(row).toBeVisible();

  const inputs = row.getByRole("textbox");
  await inputs.nth(0).fill("20123456789");
  await inputs.nth(1).fill("ACME SA");
  await inputs.nth(2).fill("indumentaria");
  await inputs.nth(3).fill("162");
  await inputs.nth(4).fill("2026-01-15");
  await inputs.nth(5).fill("12345");

  await row.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado")).toBeVisible();

  await row.getByRole("button", { name: "Encolar" }).click();
  await expect(page.getByText("Job encolado")).toBeVisible();
});

