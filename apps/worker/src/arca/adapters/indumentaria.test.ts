import { describe, expect, it, vi } from "vitest";

import { IndumentariaAdapter } from "./indumentaria";

describe("IndumentariaAdapter", () => {
  it("posts to guardarGastosInduEquip with expected fields", async () => {
    const adapter = new IndumentariaAdapter("jsessionid");
    const post = vi.fn(async () => ({ data: '<a href="eliminarDeduccion.do?id=1"></a>' }));
    (adapter as unknown as { http: { post: typeof post } }).http = { post };

    const res = await adapter.guardar({
      cuit: "20123456789",
      razonSocial: "EMPRESA SA",
      concepto: "indumentaria",
      mes: 4,
      monto: 1000,
      fechaEmision: "15/04/2026",
      tipoComprobante: 1,
      puntoVenta: "1",
      numero: "1",
    });

    expect(res).toEqual({ success: true, arcaId: "1" });
    expect(post).toHaveBeenCalledTimes(1);

    const firstCall = post.mock.calls.at(0);
    if (!firstCall) throw new Error("missing_post_call");
    const [url, body] = firstCall as unknown as [string, string];
    expect(url).toBe("/radig/jsp/guardarGastosInduEquip.do");
    expect(body).toContain("numeroDoc=20123456789");
    expect(body).toContain("razonSocial=EMPRESA+SA");
    expect(body).toContain("idConcepto=1");
    expect(body).toContain("mesDesde=4");
  });
});
