"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Sun,
  Moon,
  Type,
  Maximize2,
  Minimize2,
  AlertCircle,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, ButtonLink } from "@/components/ui/button";

interface ReaderSessionData {
  book: {
    id: string;
    title: string;
    subtitle: string | null;
    slug: string;
    author_name: string;
    publisher_name: string | null;
    file_format: string;
  };
  licence: {
    id: string;
    issued_at: string;
    max_devices: number;
    active_devices: number;
  };
  watermark: {
    buyer_name: string;
    buyer_contact: string;
    display_text: string;
    licence_ref: string;
  };
  content: {
    chapters: Array<{
      title: string;
      content: string;
    }>;
  };
}

export default function BookReaderPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = use(params);
  const router = useRouter();
  const { user, status } = useSession();

  const [sessionData, setSessionData] = useState<ReaderSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reader settings
  const [theme, setTheme] = useState<"light" | "sepia" | "dark">("sepia");
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg" | "xl">("base");
  const [fontFamily, setFontFamily] = useState<"serif" | "sans">("serif");
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [securityAlert, setSecurityAlert] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"text" | "pdf">("text");

  const containerRef = useRef<HTMLDivElement>(null);

  // Device fingerprint generation
  function getDeviceFingerprint(): string {
    if (typeof window === "undefined") return "server";
    const nav = window.navigator;
    const screen = window.screen;
    return `${nav.userAgent}-${screen.width}x${screen.height}-${nav.language}`;
  }

  // Log DRM capture security event
  async function logSecurityEvent(eventType: string) {
    try {
      await api("/reader/security-events", {
        method: "POST",
        body: {
          book_id: bookId,
          event_type: eventType,
          page: `Chapter ${currentChapterIdx + 1}`,
          device_label: navigator.userAgent.slice(0, 100),
        },
      });
    } catch {
      // Background audit logging
    }
  }

  useEffect(() => {
    async function initReader() {
      if (status === "loading") return;
      if (!user) {
        router.push(`/signin?redirect=/read/${bookId}`);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const fingerprint = encodeURIComponent(getDeviceFingerprint());
        const label = encodeURIComponent(navigator.platform || "Web Device");
        const res = await api<ReaderSessionData>(
          `/reader/books/${bookId}/session?fingerprint=${fingerprint}&label=${label}`,
        );
        setSessionData(res);
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to initialize encrypted reader session.");
      } finally {
        setLoading(false);
      }
    }

    initReader();
  }, [bookId, user, status, router]);

  // Anti-Screenshot & Screen Capture Protection
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // PrintScreen / Screenshot shortcut detection
      if (
        e.key === "PrintScreen" ||
        ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "P" || e.key === "s" || e.key === "S"))
      ) {
        e.preventDefault();
        setIsBlurred(true);
        setSecurityAlert("Screen capture and printing are restricted on DRM-protected titles.");
        logSecurityEvent(e.key === "PrintScreen" ? "screenshot_key" : "print_attempt");
        setTimeout(() => {
          setIsBlurred(false);
          setSecurityAlert(null);
        }, 3000);
      }
    }

    function handleContextMenu(e: MouseEvent) {
      e.preventDefault();
      logSecurityEvent("context_menu");
    }

    function handleCopy(e: ClipboardEvent) {
      e.preventDefault();
      setSecurityAlert("Text selection and copying are disabled on protected works.");
      logSecurityEvent("copy_attempt");
      setTimeout(() => setSecurityAlert(null), 2500);
    }

    function handleBlur() {
      setIsBlurred(true);
      logSecurityEvent("window_blur");
    }

    function handleFocus() {
      setIsBlurred(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("copy", handleCopy);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("copy", handleCopy);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [currentChapterIdx]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center space-y-3 p-6 text-center">
        <div className="size-12 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center animate-pulse">
          <BookOpen className="size-6" />
        </div>
        <h2 className="font-serif text-lg font-medium">Verifying Device & DRM Licence...</h2>
        <p className="text-xs text-muted-foreground font-mono">Decrypting AES-256-GCM session stream</p>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md mx-auto">
        <div className="size-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="size-7" />
        </div>
        <h2 className="font-serif text-xl font-medium">Unable to Open Book</h2>
        <p className="text-sm text-muted-foreground">{error || "Could not load reader session."}</p>
        <div className="flex gap-3 pt-2">
          <ButtonLink href="/dashboard/library" variant="outline" size="sm">
            Back to Library
          </ButtonLink>
          <ButtonLink href="/#collection" variant="primary" size="sm">
            Browse Storefront
          </ButtonLink>
        </div>
      </div>
    );
  }

  const chapters = sessionData.content.chapters || [];
  const currentChapter = chapters[currentChapterIdx] || chapters[0];
  const isPdf = sessionData.book.file_format?.toLowerCase() === "pdf";

  const themeClasses = {
    light: "bg-[#fcfbf9] text-[#1c1917] border-[#e7e5e4]",
    sepia: "bg-[#fbf0d9] text-[#2c1d11] border-[#eeddc1]",
    dark: "bg-[#18181b] text-[#f4f4f5] border-[#27272a]",
  }[theme];

  const fontSizeClasses = {
    sm: "text-sm leading-relaxed",
    base: "text-base leading-relaxed",
    lg: "text-lg leading-loose",
    xl: "text-xl leading-loose",
  }[fontSize];

  return (
    <div
      ref={containerRef}
      className={`min-h-screen flex flex-col select-none transition-colors duration-200 ${themeClasses}`}
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      {/* Top Header Controls */}
      <header className="sticky top-0 z-40 border-b px-4 py-3 flex items-center justify-between backdrop-blur-md bg-opacity-95">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/library"
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Back to Library"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div>
            <h1 className="font-serif font-semibold text-sm line-clamp-1">
              {sessionData.book.title}
            </h1>
            <p className="text-[11px] opacity-70">
              {sessionData.book.author_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* PDF vs Text Mode Toggle */}
          {isPdf && (
            <div className="flex items-center bg-black/5 dark:bg-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("text")}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  viewMode === "text" ? "bg-amber-500 text-ink-900 font-bold shadow-xs" : "opacity-70"
                }`}
              >
                Text
              </button>
              <button
                onClick={() => setViewMode("pdf")}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  viewMode === "pdf" ? "bg-amber-500 text-ink-900 font-bold shadow-xs" : "opacity-70"
                }`}
              >
                PDF View
              </button>
            </div>
          )}

          {/* Device & DRM Badge */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono bg-black/5 dark:bg-white/10 opacity-90">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>DRM Encrypted</span>
            <span>·</span>
            <Smartphone className="size-3" />
            <span>
              Device {sessionData.licence.active_devices}/{sessionData.licence.max_devices}
            </span>
          </div>

          {/* Theme Selector */}
          <div className="flex items-center bg-black/5 dark:bg-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setTheme("light")}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                theme === "light" ? "bg-white text-black shadow-xs font-semibold" : "opacity-70"
              }`}
              title="Light Paper"
            >
              <Sun className="size-3.5" />
            </button>
            <button
              onClick={() => setTheme("sepia")}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                theme === "sepia" ? "bg-[#eeddc1] text-[#2c1d11] shadow-xs font-semibold" : "opacity-70"
              }`}
              title="Warm Sepia"
            >
              <Sparkles className="size-3.5" />
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                theme === "dark" ? "bg-zinc-800 text-white shadow-xs font-semibold" : "opacity-70"
              }`}
              title="Midnight Dark"
            >
              <Moon className="size-3.5" />
            </button>
          </div>

          {/* Font Controls */}
          {viewMode === "text" && (
            <div className="hidden md:flex items-center bg-black/5 dark:bg-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setFontFamily(fontFamily === "serif" ? "sans" : "serif")}
                className="px-2 py-1 rounded text-xs font-mono opacity-80 hover:opacity-100"
                title="Toggle Font"
              >
                <Type className="size-3.5" />
              </button>
              <button
                onClick={() => {
                  const sizes: Array<"sm" | "base" | "lg" | "xl"> = ["sm", "base", "lg", "xl"];
                  const currIdx = sizes.indexOf(fontSize);
                  setFontSize(sizes[(currIdx + 1) % sizes.length]);
                }}
                className="px-2 py-1 rounded text-xs font-mono uppercase opacity-80 hover:opacity-100"
                title="Change Size"
              >
                {fontSize}
              </button>
            </div>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </header>

      {/* Floating Security Warning Banner if triggered */}
      {securityAlert && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs shadow-lg flex items-center gap-2 animate-bounce">
          <AlertCircle className="size-4" />
          <span>{securityAlert}</span>
        </div>
      )}

      {/* Privacy Mask for Window Blur / Screenshot Protection */}
      {isBlurred && (
        <div className="fixed inset-0 z-50 backdrop-blur-xl bg-black/70 flex flex-col items-center justify-center p-6 text-white text-center space-y-3">
          <EyeOff className="size-10 text-amber-400 animate-pulse" />
          <h3 className="font-serif text-lg font-medium">Protected View Paused</h3>
          <p className="text-xs text-zinc-300 max-w-sm">
            Content is hidden while window focus is lost or during screen capture attempts. Click anywhere to resume reading.
          </p>
        </div>
      )}

      {/* Reading Canvas with Dynamic Watermark Grid */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 relative">
        {/* Dynamic Canvas Watermarking Overlay */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden select-none z-30 opacity-15"
          style={{ userSelect: "none" }}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-32 gap-x-16 -rotate-12 transform scale-110 pt-16">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="font-mono text-[11px] uppercase tracking-wider font-semibold whitespace-nowrap">
                {sessionData.watermark.display_text}
              </div>
            ))}
          </div>
        </div>

        {/* View Mode: Native PDF Stream vs Formatted Text View */}
        {viewMode === "pdf" ? (
          <div className="relative z-20 w-full h-[calc(100vh-140px)] rounded-2xl overflow-hidden border border-border/80 bg-black/5 shadow-inner">
            <iframe
              src={`http://localhost:4000/api/reader/books/${sessionData.book.id}/stream`}
              className="w-full h-full rounded-2xl"
              title={sessionData.book.title}
            />
          </div>
        ) : (
          <article
            className={`relative z-20 space-y-6 ${fontFamily === "serif" ? "font-serif" : "font-sans"} ${fontSizeClasses}`}
          >
            <div className="border-b pb-4 mb-6 opacity-80 flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest">
                {currentChapter.title}
              </span>
              <span className="font-mono text-xs opacity-70">
                Chapter {currentChapterIdx + 1} of {chapters.length}
              </span>
            </div>

            <div className="space-y-6 text-justify whitespace-pre-line leading-relaxed">
              {currentChapter.content}
            </div>
          </article>
        )}
      </main>

      {/* Bottom Chapter Pagination Navigation */}
      {viewMode === "text" && (
        <footer className="sticky bottom-0 z-40 border-t px-6 py-4 backdrop-blur-md bg-opacity-95 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentChapterIdx((p) => Math.max(0, p - 1))}
            disabled={currentChapterIdx === 0}
          >
            <ChevronLeft className="size-4 mr-1" /> Previous
          </Button>

          <div className="text-xs font-mono opacity-80">
            Chapter {currentChapterIdx + 1} / {chapters.length}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentChapterIdx((p) => Math.min(chapters.length - 1, p + 1))}
            disabled={currentChapterIdx >= chapters.length - 1}
          >
            Next <ChevronRight className="size-4 ml-1" />
          </Button>
        </footer>
      )}
    </div>
  );
}
