import type { ReactNode } from "react";
import { Preloader } from "@/components/public/preloader";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Preloader />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
