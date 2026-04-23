"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  cuit: z.string().regex(/^[0-9]{11}$/),
  claveFiscal: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function ArcaCredentialsForm() {
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { cuit: "", claveFiscal: "" },
  });

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/arca/credentials");
        const json: unknown = await res.json();
        if (!res.ok) return;
        const parsed = z
          .object({
            ok: z.literal(true),
            credentials: z
              .object({ cuit: z.string().optional().nullable() })
              .nullable(),
          })
          .safeParse(json);
        if (!parsed.success) return;
        const cuit = parsed.data.credentials?.cuit;
        if (cuit) form.setValue("cuit", cuit);
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [form]);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/arca/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg = z.object({ error: z.string().optional() }).safeParse(json);
        toast.error(msg.success ? msg.data.error ?? "Error" : "Error");
        return;
      }
      toast.success("Credenciales guardadas");
      form.reset({ cuit: values.cuit, claveFiscal: "" });
    } finally {
      setIsLoading(false);
    }
  };

  const onTest = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/arca/test-credentials", { method: "POST" });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg = z.object({ error: z.string().optional() }).safeParse(json);
        toast.error(msg.success ? msg.data.error ?? "Error" : "Error");
        return;
      }
      toast.success("Conexión OK");
      void json;
    } finally {
      setIsLoading(false);
    }
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
        <Button type="submit" className="flex-1" disabled={isLoading}>
          Guardar
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={isLoading}
          onClick={onTest}
        >
          Probar conexión
        </Button>
      </div>
    </form>
  );
}
