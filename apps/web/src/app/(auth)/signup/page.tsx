import Link from "next/link";

import { SignupForm } from "@/components/organisms/SignupForm";

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Crear cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Registrate con email y contraseña.
        </p>
      </div>
      <SignupForm />
      <p className="text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-foreground underline">
          Ingresar
        </Link>
      </p>
    </div>
  );
}
