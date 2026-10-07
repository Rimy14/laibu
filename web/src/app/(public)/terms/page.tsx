import type { Metadata } from "next";
import { LegalPlaceholder } from "@/components/public/legal-placeholder";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return <LegalPlaceholder title="Terms of use" />;
}
