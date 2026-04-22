import type { Job } from "bullmq";

import { loginToArca } from "../arca/login";
import {
  IndumentariaAdapter,
  type IndumentariaInput,
} from "../arca/adapters/indumentaria";

export type CargarDeduccionJobData = {
  cuit: string;
  claveFiscal: string;
  categoria: "indumentaria" | "equipamiento";
  input: Omit<IndumentariaInput, "concepto">;
};

export async function cargarDeduccion(job: Job<CargarDeduccionJobData>) {
  const { cuit, claveFiscal, categoria, input } = job.data;
  const session = await loginToArca(cuit, claveFiscal);
  const adapter = new IndumentariaAdapter(session.jsessionid);
  return adapter.guardar({ ...input, concepto: categoria });
}
