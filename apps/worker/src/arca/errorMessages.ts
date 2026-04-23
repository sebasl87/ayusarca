const KNOWN_ERRORS: [RegExp | string, string][] = [
  [/cuit.*inv[aá]lido/i, "El CUIT del proveedor es inválido o no está registrado en ARCA."],
  [/cuit.*no.*encontrado/i, "El CUIT del proveedor no fue encontrado en ARCA."],
  [/ya.*existe.*comprobante/i, "Este comprobante ya fue cargado anteriormente."],
  [/comprobante.*duplicado/i, "Comprobante duplicado: ya existe en SiRADIG."],
  [/monto.*inv[aá]lido/i, "El monto ingresado no es válido."],
  [/fecha.*inv[aá]lida/i, "La fecha de emisión es inválida."],
  [/per[ií]odo.*cerrado/i, "El período fiscal ya está cerrado y no acepta nuevas deducciones."],
  [/sesi[oó]n.*expir/i, "La sesión en ARCA expiró. Reintentando login."],
  [/error.*sistema/i, "Error interno del sistema de ARCA. Reintentá más tarde."],
  [/no.*autorizado/i, "No autorizado en ARCA. Verificá tus credenciales."],
];

export function friendlyArcaError(rawError: string): string {
  for (const [pattern, friendly] of KNOWN_ERRORS) {
    if (typeof pattern === "string" ? rawError.includes(pattern) : pattern.test(rawError)) {
      return friendly;
    }
  }
  return `Error de ARCA: ${rawError}`;
}
