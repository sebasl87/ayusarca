export default function DashboardHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Estado general de cargas y deducciones.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <div className="text-sm text-muted-foreground">Facturas</div>
          <div className="text-2xl font-semibold">—</div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="text-sm text-muted-foreground">Pendientes</div>
          <div className="text-2xl font-semibold">—</div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="text-sm text-muted-foreground">Cargadas</div>
          <div className="text-2xl font-semibold">—</div>
        </div>
      </div>
    </div>
  );
}
