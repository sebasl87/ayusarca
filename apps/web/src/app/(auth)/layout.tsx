import type { ReactNode } from "react";

export default function AuthLayout(props: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">{props.children}</div>
    </div>
  );
}
