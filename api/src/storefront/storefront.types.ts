export interface StorefrontBookItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  language: string;
  page_count: number | null;
  price_kes: string;
  is_superadmin_book: boolean;
  author_id: string;
  author_name: string;
  author_room_slug: string | null;
  publisher_name: string | null;
  file_format: string | null;
  cover_object_key: string | null;
  live_at: string | null;
}

export interface AuthorRoomDetails {
  author: {
    id: string;
    full_name: string;
    bio: string | null;
    room_slug: string | null;
  };
  books: StorefrontBookItem[];
  pinned_books: StorefrontBookItem[];
}
