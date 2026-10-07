"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";

const MIN_VISIBLE_MS = 900; // long enough to read as intentional, short enough not to annoy

/**
 * Public-site preloader. Server-rendered, so it covers the page from the very
 * first paint; it leaves once the page has fully loaded. Client-side
 * navigation never shows it again (the public layout stays mounted).
 */
export function Preloader() {
  const [state, setState] = useState<"loading" | "done" | "gone">("loading");

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      const wait = Math.max(0, MIN_VISIBLE_MS - performance.now());
      window.setTimeout(() => !cancelled && setState("done"), wait);
    };
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", finish);
    };
  }, []);

  useEffect(() => {
    if (state !== "done") return;
    const t = window.setTimeout(() => setState("gone"), 600);
    return () => window.clearTimeout(t);
  }, [state]);

  if (state === "gone") return null;

  return (
    <div className="preloader" data-state={state} role="status" aria-live="polite" aria-label={`Loading ${BRAND.name}`}>
      <div className="preloader__inner">
        <div className="pl-book" aria-hidden>
          <div className="pl-book__cover" />
          <div className="pl-book__half pl-book__half--left" />
          <div className="pl-book__half pl-book__half--right" />
          <div className="pl-book__page" />
          <div className="pl-book__page pl-book__page--2" />
          <div className="pl-book__page pl-book__page--3" />
          <div className="pl-book__spine" />
        </div>
        <div className="pl-word" aria-hidden>
          {BRAND.name}
          <span>.</span>
        </div>
        <div className="pl-line" aria-hidden />
        <p className="pl-caption">Opening the library</p>
      </div>
    </div>
  );
}
