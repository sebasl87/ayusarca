"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: FormValues) => {
    void values;
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-1">
        <Input placeholder="Email" type="email" {...form.register("email")} />
      </div>
      <div className="space-y-1">
        <Input
          placeholder="Contraseña"
          type="password"
          {...form.register("password")}
        />
      </div>
      <Button type="submit" className="w-full">
        Ingresar
      </Button>
    </form>
  );
}
