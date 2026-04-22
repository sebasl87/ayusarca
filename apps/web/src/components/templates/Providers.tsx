"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { useState } from "react";
import { Toaster } from "sonner";

export function Providers(props: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <JotaiProvider>
        <QueryClientProvider client={queryClient}>
          {props.children}
          <Toaster richColors closeButton />
        </QueryClientProvider>
      </JotaiProvider>
    </ThemeProvider>
  );
}
