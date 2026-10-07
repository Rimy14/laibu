"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "@/lib/session";
import { TermsGate } from "./account/terms";
import { ConfirmProvider } from "./ui/dialog";
import { ToastProvider } from "./ui/toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <SessionProvider>
          {children}
          <TermsGate />
        </SessionProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
