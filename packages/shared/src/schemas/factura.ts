import { z } from "zod";

export const cuitSchema = z
  .string()
  .regex(/^[0-9]{11}$/, "CUIT debe tener 11 dígitos");

export const facturaEditedSchema = z.object({
  cuit: cuitSchema,
  razonSocial: z.string().min(1).max(200),
  tipoComprobante: z.enum(["A", "B", "C", "M", "E"]),
  puntoVenta: z.string().regex(/^[0-9]{4,5}$/),
  numero: z.string().regex(/^[0-9]{1,8}$/),
  fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  montoTotal: z.number().positive(),
  categoria: z.enum([
    "indumentaria",
    "equipamiento",
    "educacion",
    "alquiler",
    "medicina_prepaga",
    "primas_seguro",
    "donaciones",
    "servicio_domestico",
    "gastos_medicos",
    "intereses_hipotecarios",
  ]),
  mesDeduccion: z.number().int().min(1).max(12),
});

export type FacturaEdited = z.infer<typeof facturaEditedSchema>;
