import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "trichy_bookmarks_v1";

export interface Bookmark {
  id: string;
  slug: string;
  title: string;
  category: string;
  cover_image_url: string | null;
  excerpt: string;
  savedAt: string;
}

const load = (): Bookmark[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Bookmark[]) : [];
  } catch {
    return [];
  }
};

const save = (items: Bookmark[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
};

export const useBookmarks = () => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(load);

  useEffect(() => {
    save(bookmarks);
  }, [bookmarks]);

  const toggle = useCallback((article: Omit<Bookmark, "savedAt">) => {
    setBookmarks((prev) => {
      const exists = prev.find((b) => b.id === article.id);
      return exists
        ? prev.filter((b) => b.id !== article.id)
        : [{ ...article, savedAt: new Date().toISOString() }, ...prev];
    });
  }, []);

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((b) => b.id === id),
    [bookmarks],
  );

  const clear = useCallback(() => setBookmarks([]), []);

  return { bookmarks, toggle, isBookmarked, clear };
};
