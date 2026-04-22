"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine(
    (v: { password: string; confirmPassword: string }) => {
      return v.password === v.confirmPassword;
    },
    {
      message: "Las contraseñas no coinciden",
      path: ["confirmPassword"],
    },
  );

type FormValues = z.infer<typeof schema>;

export function SignupForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = (values: FormValues) => {
    void values;
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <Input placeholder="Email" type="email" {...form.register("email")} />
      <Input
        placeholder="Contraseña"
        type="password"
        {...form.register("password")}
      />
      <Input
        placeholder="Confirmar contraseña"
        type="password"
        {...form.register("confirmPassword")}
      />
      <Button type="submit" className="w-full">
        Crear cuenta
      </Button>
    </form>
  );
}
