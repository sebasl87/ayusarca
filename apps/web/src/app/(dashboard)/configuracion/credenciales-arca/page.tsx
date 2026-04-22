import { ArcaCredentialsForm } from "@/components/organisms/ArcaCredentialsForm";

export default function CredencialesArcaPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Credenciales ARCA
        </h1>
        <p className="text-sm text-muted-foreground">
          Guardadas encriptadas. La clave fiscal no se loguea.
        </p>
      </div>
      <div className="rounded-lg border border-border p-4">
        <ArcaCredentialsForm />
      </div>
    </div>
  );
}
