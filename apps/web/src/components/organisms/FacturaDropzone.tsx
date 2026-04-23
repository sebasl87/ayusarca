"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";

export function FacturaDropzone() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev: File[]) => [...prev, ...acceptedFiles]);
    if (acceptedFiles.length > 0) toast.success("Archivos agregados");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
  });

  const onUpload = async () => {
    if (files.length === 0) return;
    setIsSubmitting(true);
    try {
      const form = new FormData();
      for (const file of files) form.append("files", file);

      const uploadRes = await fetch("/api/facturas/upload", {
        method: "POST",
        body: form,
      });
      const uploadJson: unknown = await uploadRes.json();
      const parsed = z
        .object({
          ok: z.boolean(),
          facturas: z.array(z.object({ id: z.string() })).optional(),
          error: z.string().optional(),
        })
        .safeParse(uploadJson);

      if (
        !uploadRes.ok ||
        !parsed.success ||
        !parsed.data.ok ||
        !parsed.data.facturas
      ) {
        const msg =
          parsed.success && parsed.data.error
            ? parsed.data.error
            : "Error subiendo facturas";
        toast.error(msg);
        return;
      }

      const facturaIds = parsed.data.facturas.map((f) => f.id);
      toast.success(`Subidas: ${facturaIds.length}`);

      const concurrency = 3;
      let index = 0;
      const runOne = async () => {
        while (index < facturaIds.length) {
          const facturaId = facturaIds[index];
          index += 1;
          const res = await fetch("/api/facturas/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ facturaId }),
          });
          const json: unknown = await res.json();
          if (!res.ok) {
            const err = z
              .object({ error: z.string().optional() })
              .safeParse(json);
            toast.error(
              err.success
                ? (err.data.error ?? "Error extrayendo")
                : "Error extrayendo",
            );
          }
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(concurrency, facturaIds.length) },
          runOne,
        ),
      );

      toast.success("Extracción finalizada");
      router.push("/facturas");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={[
          "flex h-40 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm",
          isDragActive ? "ring-2 ring-ring" : "",
        ].join(" ")}
      >
        <input {...getInputProps()} />
        {isDragActive
          ? "Soltá los archivos acá"
          : "Drag & drop o click para subir"}
      </div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {files.map((f: File) => (
          <li key={`${f.name}-${f.size}`}>{f.name}</li>
        ))}
      </ul>
      <button
        type="button"
        disabled={files.length === 0 || isSubmitting}
        onClick={() => void onUpload()}
        className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Subir y extraer
      </button>
    </div>
  );
}
