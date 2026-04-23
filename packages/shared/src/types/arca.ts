export type ArcaCategoria =
  | "indumentaria"
  | "equipamiento"
  | "educacion"
  | "alquiler"
  | "medicina_prepaga"
  | "primas_seguro"
  | "donaciones"
  | "servicio_domestico"
  | "gastos_medicos"
  | "intereses_hipotecarios";

export type ArcaTipoComprobante = "A" | "B" | "C" | "M" | "E";

export type ArcaFormEndpoint = {
  verPath: string;
  guardarPath: string;
  experimental: boolean;
};

export const ARCA_ENDPOINTS: Record<ArcaCategoria, ArcaFormEndpoint> = {
  indumentaria: {
    verPath: "/radig/jsp/verGastosInduEquip.do",
    guardarPath: "/radig/jsp/guardarGastosInduEquip.do",
    experimental: false,
  },
  equipamiento: {
    verPath: "/radig/jsp/verGastosInduEquip.do",
    guardarPath: "/radig/jsp/guardarGastosInduEquip.do",
    experimental: false,
  },
  educacion: {
    verPath: "/radig/jsp/verGastosEducacion.do",
    guardarPath: "/radig/jsp/guardarGastosEducacion.do",
    experimental: false,
  },
  alquiler: {
    verPath: "/radig/jsp/verAlquileres.do",
    guardarPath: "/radig/jsp/guardarAlquileres.do",
    experimental: false,
  },
  medicina_prepaga: {
    verPath: "/radig/jsp/verMedicinaPrepaga.do",
    guardarPath: "/radig/jsp/guardarMedicinaPrepaga.do",
    experimental: false,
  },
  primas_seguro: {
    verPath: "/radig/jsp/verPrimasSeguro.do",
    guardarPath: "/radig/jsp/guardarPrimasSeguro.do",
    experimental: true,
  },
  donaciones: {
    verPath: "/radig/jsp/verDonaciones.do",
    guardarPath: "/radig/jsp/guardarDonaciones.do",
    experimental: true,
  },
  servicio_domestico: {
    verPath: "/radig/jsp/verServicioDomestico.do",
    guardarPath: "/radig/jsp/guardarServicioDomestico.do",
    experimental: true,
  },
  gastos_medicos: {
    verPath: "/radig/jsp/verGastosMedicos.do",
    guardarPath: "/radig/jsp/guardarGastosMedicos.do",
    experimental: true,
  },
  intereses_hipotecarios: {
    verPath: "/radig/jsp/verInteresesHipotecarios.do",
    guardarPath: "/radig/jsp/guardarInteresesHipotecarios.do",
    experimental: true,
  },
};
