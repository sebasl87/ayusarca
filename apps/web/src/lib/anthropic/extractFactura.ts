import OpenAI from "openai";
import { z } from "zod";

const extractionSchema = z.object({
  cuit_emisor: z.string().regex(/^[0-9]{11}$/).nullable(),
  razon_social: z.string().min(1).max(200).nullable(),
  tipo_comprobante: z.string().min(1).max(5).nullable(),
  punto_venta: z.string().min(1).max(10).nullable(),
  numero_comprobante: z.string().min(1).max(20).nullable(),
  fecha_emision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  monto_total: z.number().nullable(),
  categoria_sugerida: z.string().min(1).max(50).nullable(),
  confianza: z.number().min(0).max(1).nullable(),
  observaciones: z.string().max(500).nullable(),
});

export type FacturaExtraction = z.infer<typeof extractionSchema>;

const EXTRACTION_PROMPT =
  'Sos un asistente experto en facturas argentinas (ARCA/AFIP). Extrae los siguientes datos en formato JSON estricto. Si algún dato no está o no se ve claro, devolvelo como null. Responder SOLO con un JSON válido, sin texto antes ni después, con la siguiente estructura: {"cuit_emisor":"20304050607","razon_social":"EMPRESA SA","tipo_comprobante":"A","punto_venta":"0001","numero_comprobante":"00012345","fecha_emision":"2026-04-15","monto_total":12345.67,"categoria_sugerida":"indumentaria","confianza":0.95,"observaciones":null}';

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("json_parse_failed");
    return JSON.parse(match[0]);
  }
}

function createClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY!,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}

export async function extractFacturaFromPdf(params: {
  buffer: Buffer;
}): Promise<{ data: FacturaExtraction; raw: unknown }> {
  const client = createClient();

  const pdfText = await extractPdfText(params.buffer);

  const prompt = `${EXTRACTION_PROMPT}\n\nContenido extraído del PDF:\n${pdfText}`;

  const res = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.choices[0]?.message?.content?.trim() ?? "";
  let parsed: unknown;
  try {
    parsed = tryParseJson(text);
  } catch {
    throw new Error(`grok_parse_failed: ${text.slice(0, 200)}`);
  }

  return { data: extractionSchema.parse(parsed), raw: res };
}

export async function extractFacturaFromImage(params: {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}): Promise<{ data: FacturaExtraction; raw: unknown }> {
  const client = createClient();
  const base64 = params.buffer.toString("base64");
  const dataUrl = `data:${params.mimeType};base64,${base64}`;

  const res = await client.chat.completions.create({
    model: "llama-3.2-11b-vision-preview",
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  const text = res.choices[0]?.message?.content?.trim() ?? "";
  let parsed: unknown;
  try {
    parsed = tryParseJson(text);
  } catch {
    throw new Error(`grok_parse_failed: ${text.slice(0, 200)}`);
  }

  return { data: extractionSchema.parse(parsed), raw: res };
}
