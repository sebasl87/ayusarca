"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  cuit: z.string().regex(/^[0-9]{11}$/),
  claveFiscal: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function ArcaCredentialsForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { cuit: "", claveFiscal: "" },
  });

  const onSubmit = (values: FormValues) => {
    void values;
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <Input placeholder="CUIT (11 dígitos)" {...form.register("cuit")} />
      <Input
        placeholder="Clave Fiscal"
        type="password"
        {...form.register("claveFiscal")}
      />
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Guardar
        </Button>
        <Button type="button" variant="outline" className="flex-1">
          Probar conexión
        </Button>
      </div>
    </form>
  );
}
