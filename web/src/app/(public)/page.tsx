import { Collection } from "@/components/public/collection";
import { AuthorsBand, BookGridSection, Hero, HowItWorks } from "@/components/public/sections";
import { SAMPLE_BOOKS, storefrontOrder } from "@/lib/sample-books";

// Preview with sample data. Sprint 4 swaps in GET /api/storefront
// (superadmin books first, §2.4).
export default function StorefrontPage() {
  const books = storefrontOrder(SAMPLE_BOOKS);
  const bestsellers = books.filter((b) => b.pinned || b.bestseller).slice(0, 4);

  return (
    <>
      <Hero featured={[books[2], books[0], books[4]]} />
      <BookGridSection
        id="bestsellers"
        label="Readers love these"
        title="Bestselling books"
        intro="Picks from the Laibu team and this month's most-bought titles."
        books={bestsellers}
      />
      <AuthorsBand />
      <HowItWorks />
      <Collection books={books} />
    </>
  );
}
