import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  cuit: z.string().regex(/^[0-9]{11}$/),
  claveFiscal: z.string().min(1),
});

export async function POST(req: Request) {
  const json = await req.json();
  const data = schema.parse(json);
  void data;
  return NextResponse.json({ ok: true });
}
