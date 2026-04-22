import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          SiRADIG Auto-Loader
        </h1>
        <p className="text-muted-foreground">
          Subí facturas, extraé datos con visión y cargá deducciones en SiRADIG
          (ARCA) de forma automatizada.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Ingresar
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center rounded-md border border-border bg-background px-4 text-sm font-medium"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </main>
  );
}
