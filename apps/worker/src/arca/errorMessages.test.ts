import { describe, expect, it } from "vitest";

import { friendlyArcaError } from "./errorMessages";

describe("friendlyArcaError", () => {
  it("maps known CUIT error pattern", () => {
    const msg = friendlyArcaError("El CUIT ingresado es inválido");
    expect(msg).toContain("CUIT");
  });

  it("maps duplicado comprobante", () => {
    const msg = friendlyArcaError("comprobante duplicado en el sistema");
    expect(msg).toContain("duplicado");
  });

  it("maps período cerrado", () => {
    const msg = friendlyArcaError("El período fiscal está cerrado");
    expect(msg).toContain("período");
  });

  it("returns prefixed raw error for unknown messages", () => {
    const msg = friendlyArcaError("algo inesperado xyzzy");
    expect(msg).toMatch(/^Error de ARCA:/);
    expect(msg).toContain("algo inesperado xyzzy");
  });
});
