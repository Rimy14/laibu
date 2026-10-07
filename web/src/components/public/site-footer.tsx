import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Logo } from "./logo";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/#bestsellers", label: "Bestsellers" },
      { href: "/#collection", label: "All books" },
      { href: "/#how-it-works", label: "How it works" },
    ],
  },
  {
    title: "Publish",
    links: [
      { href: "/signup?role=author", label: "Become an author" },
      { href: "/signup?role=publisher", label: "Publish as a company" },
      { href: "/#authors", label: "Fees and payouts" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/terms", label: "Terms of use" },
      { href: "/privacy", label: "Privacy policy" },
      { href: `mailto:${BRAND.supportEmail}`, label: "Contact support" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-ink-900 text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Logo />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/55">
            Ebooks from Kenyan authors and publishers. Pay with M-Pesa, read on your own devices.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="font-sans text-sm font-medium text-white">{col.title}</h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-white/55 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/8">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-white/40 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {BRAND.company}. All rights reserved.
          </p>
          <p>Made in Kenya</p>
        </div>
      </div>
    </footer>
  );
}
