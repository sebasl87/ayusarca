import { z } from "zod";

import { createAnthropicClient } from "./client";

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
  'Sos un asistente experto en facturas argentinas (ARCA/AFIP). Te paso la imagen de una factura. Extrae los siguientes datos en formato JSON estricto. Si algún dato no está o no se ve claro, devolvelo como null. Responder SOLO con un JSON válido, sin texto antes ni después, con la siguiente estructura: {"cuit_emisor":"20304050607","razon_social":"EMPRESA SA","tipo_comprobante":"A","punto_venta":"0001","numero_comprobante":"00012345","fecha_emision":"2026-04-15","monto_total":12345.67,"categoria_sugerida":"indumentaria","confianza":0.95,"observaciones":null}';

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("json_parse_failed");
    return JSON.parse(match[0]);
  }
}

export async function extractFacturaFromPdf(params: {
  buffer: Buffer;
}): Promise<{ data: FacturaExtraction; raw: unknown }> {
  const client = createAnthropicClient();
  const base64 = params.buffer.toString("base64");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfContent: any[] = [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
    { type: "text", text: EXTRACTION_PROMPT },
  ];

  const makeRequest = () =>
    client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      temperature: 0,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      messages: [{ role: "user", content: pdfContent }],
    });

  const res = await makeRequest();
  const text = res.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();

  let parsed: unknown;
  try {
    parsed = tryParseJson(text);
  } catch {
    const retry = await makeRequest();
    const retryText = retry.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();
    parsed = tryParseJson(retryText);
    return { data: extractionSchema.parse(parsed), raw: retry };
  }

  return { data: extractionSchema.parse(parsed), raw: res };
}

export async function extractFacturaFromImage(params: {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}): Promise<{ data: FacturaExtraction; raw: unknown }> {
  const client = createAnthropicClient();
  const base64 = params.buffer.toString("base64");

  const res = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1200,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_PROMPT },
          {
            type: "image",
            source: { type: "base64", media_type: params.mimeType, data: base64 },
          },
        ],
      },
    ],
  });

  const text = res.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();

  let parsed: unknown;
  try {
    parsed = tryParseJson(text);
  } catch {
    const retry = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${EXTRACTION_PROMPT}\n\nRecordatorio: respondé SOLO JSON válido.`,
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: params.mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
    });
    const retryText = retry.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();
    parsed = tryParseJson(retryText);
    return { data: extractionSchema.parse(parsed), raw: retry };
  }

  return { data: extractionSchema.parse(parsed), raw: res };
}
