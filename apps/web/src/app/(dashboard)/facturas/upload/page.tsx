import { FacturaDropzone } from "@/components/organisms/FacturaDropzone";

export default function FacturasUploadPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subir facturas</h1>
        <p className="text-sm text-muted-foreground">
          Imágenes o PDFs. Luego se extraen datos para cargar en SiRADIG.
        </p>
      </div>
      <FacturaDropzone />
    </div>
  );
}
