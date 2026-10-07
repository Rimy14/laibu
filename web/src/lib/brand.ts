/** Central brand config: rename the product here only (DEVELOPER_DOCUMENTATION branding note). */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Laibu",
  company: "SomaPay",
  tagline: "Kenyan books, protected and yours.",
  domain: "laibu.co.ke",
  supportEmail: "support@laibu.co.ke",
  currency: "KES",
} as const;

export function formatKes(amount: number | string) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
