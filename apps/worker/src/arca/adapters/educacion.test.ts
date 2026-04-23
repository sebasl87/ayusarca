import { describe, expect, it, vi } from "vitest";

import { EducacionAdapter } from "./educacion";

describe("EducacionAdapter", () => {
  it("posts to guardarGastosEducacion with expected fields", async () => {
    const adapter = new EducacionAdapter("jsessionid");
    const post = vi.fn(async () => ({ data: '<a href="eliminarDeduccion.do?id=42"></a>' }));
    (adapter as unknown as { http: { post: typeof post } }).http = { post };

    const res = await adapter.guardar({
      cuit: "20123456789",
      razonSocial: "INSTITUTO SA",
      idConcepto: 3,
      mes: 3,
      monto: 5000,
      fechaEmision: "10/03/2026",
      tipoComprobante: 6,
      puntoVenta: "2",
      numero: "123",
    });

    expect(res).toEqual({ success: true, arcaId: "42" });
    const call = post.mock.calls[0];
    if (!call) throw new Error("expected post to be called");
    const [url, body] = call as unknown as [string, string];
    expect(url).toBe("/radig/jsp/guardarGastosEducacion.do");
    expect(body).toContain("idConcepto=3");
    expect(body).toContain("mesDesde=3");
    expect(body).toContain("montoTotal=5000.00");
    expect(body).toContain("comprobanteTipo=6");
    expect(body).toContain("comprobantePuntoVenta=0002");
    expect(body).toContain("comprobanteNumero=00000123");
  });

  it("returns error when arca returns errorMessage element", async () => {
    const adapter = new EducacionAdapter("jsessionid");
    const post = vi.fn(async () => ({ data: '<div class="errorMessage">CUIT inválido</div>' }));
    (adapter as unknown as { http: { post: typeof post } }).http = { post };

    const res = await adapter.guardar({
      cuit: "20000000000",
      razonSocial: "X",
      idConcepto: 1,
      mes: 1,
      monto: 100,
      fechaEmision: "01/01/2026",
      tipoComprobante: 1,
      puntoVenta: "1",
      numero: "1",
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("CUIT inválido");
  });
});
