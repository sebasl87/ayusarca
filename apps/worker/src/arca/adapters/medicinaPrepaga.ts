import { ArcaFormAdapter } from "./base";
import { parseArcaResponse } from "../parseResponse";

export type MedicinaPrepagaInput = {
  cuit: string;
  razonSocial: string;
  idConcepto: number;
  mes: number;
  monto: number;
  fechaEmision: string;
  tipoComprobante: number;
  puntoVenta: string;
  numero: string;
};

export class MedicinaPrepagaAdapter extends ArcaFormAdapter<MedicinaPrepagaInput> {
  async guardar(data: MedicinaPrepagaInput) {
    const body = new URLSearchParams({
      numeroDoc: data.cuit,
      razonSocial: data.razonSocial,
      idConcepto: String(data.idConcepto),
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

    const res = await this.http.post("/radig/jsp/guardarMedicinaPrepaga.do", body.toString());
    const parsed = parseArcaResponse(String(res.data));
    if (!parsed.success) return { success: false, error: parsed.error };
    return { success: true, arcaId: parsed.arcaId };
  }
}
