import { ArcaFormAdapter } from "./base";
import { parseArcaResponse } from "../parseResponse";

export type IndumentariaInput = {
  cuit: string;
  razonSocial: string;
  concepto: "indumentaria" | "equipamiento";
  mes: number;
  monto: number;
  fechaEmision: string;
  tipoComprobante: number;
  puntoVenta: string;
  numero: string;
};

export class IndumentariaAdapter extends ArcaFormAdapter<IndumentariaInput> {
  async guardar(data: IndumentariaInput) {
    const body = new URLSearchParams({
      numeroDoc: data.cuit,
      razonSocial: data.razonSocial,
      idConcepto: String(data.concepto === "indumentaria" ? 1 : 2),
      mesDesde: String(data.mes),
      montoTotal: data.monto.toFixed(2),
      numeroDocTmp: data.cuit,
      comprobanteIdFilaAgregada: "1",
      comprobanteFechaEmision: data.fechaEmision,
      comprobanteTipo: String(data.tipoComprobante),
      comprobantePuntoVenta: data.puntoVenta.padStart(4, "0"),
      comprobanteNumero: data.numero.padStart(8, "0"),
      comprobanteNumeroAlternativo: "",
      comprobanteMontoFacturado: data.monto.toFixed(2),
      comprobantesEliminados: "",
      codigo: "",
    });

    const res = await this.http.post(
      "/radig/jsp/guardarGastosInduEquip.do",
      body.toString()
    );

    this.checkStatus(res.status, String(res.data));
    const parsed = parseArcaResponse(String(res.data));
    if (!parsed.success) return { success: false, error: parsed.error };
    return { success: true, arcaId: parsed.arcaId };
  }
}
