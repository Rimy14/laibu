import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Showcase } from "./showcase";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Showcase />;
}
