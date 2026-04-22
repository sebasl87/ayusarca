import Link from "next/link";

import { LoginForm } from "@/components/organisms/LoginForm";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ingresar</h1>
        <p className="text-sm text-muted-foreground">
          Accedé con tu email y contraseña.
        </p>
      </div>
      <LoginForm />
      <p className="text-sm text-muted-foreground">
        ¿No tenés cuenta?{" "}
        <Link href="/signup" className="text-foreground underline">
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
