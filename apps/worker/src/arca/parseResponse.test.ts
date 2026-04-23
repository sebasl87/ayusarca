import { describe, expect, it } from "vitest";

import { parseArcaResponse } from "./parseResponse";

describe("parseArcaResponse", () => {
  it("returns error when error element exists", () => {
    const html = '<div class="errorMessage">CUIT inválido</div>';
    expect(parseArcaResponse(html)).toEqual({ success: false, error: "CUIT inválido" });
  });

  it("extracts arca id from last eliminar link", () => {
    const html =
      '<a href="eliminarDeduccion.do?id=12">Eliminar</a><a href="eliminarDeduccion.do?id=99">Eliminar</a>';
    expect(parseArcaResponse(html)).toEqual({ success: true, arcaId: "99" });
  });
});
