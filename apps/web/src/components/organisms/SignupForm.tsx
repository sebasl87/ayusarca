"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Cuenta creada");
      router.push("/dashboard");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
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
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        Crear cuenta
      </Button>
    </form>
  );
}
