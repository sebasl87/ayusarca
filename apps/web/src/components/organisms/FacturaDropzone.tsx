"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

export function FacturaDropzone() {
  const [files, setFiles] = useState<File[]>([]);

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
    </div>
  );
}
