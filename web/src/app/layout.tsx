import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { BRAND } from "@/lib/brand";
import "./globals.css";

// Editorial serif for headings, crisp (not rounded) sans for reading.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});
const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${BRAND.name}: ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: "Buy DRM-protected ebooks from Kenyan authors and publishers with M-Pesa.",
};

export const viewport: Viewport = {
  themeColor: "#1d1d20",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading the request headers renders every page per request, which is what
  // lets Next.js attach the CSP nonce from src/proxy.ts to its scripts.
  await headers();

  return (
    <html lang="en" className={`${newsreader.variable} ${instrument.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
