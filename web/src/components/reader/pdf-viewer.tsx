"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, AlertCircle, Loader2 } from "lucide-react";

interface PdfViewerProps {
  /** API path, e.g. /reader/books/:id/stream  — fetched with same-origin credentials */
  src: string;
  title?: string;
}

export function PdfViewer({ src, title }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.3);
  const [rendering, setRendering] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setLoading(true);
        setLoadError(null);

        // 1. Fetch the encrypted+decrypted stream as raw bytes
        const res = await fetch(`/api${src}`, { credentials: "same-origin" });
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          throw new Error(`Stream error ${res.status}: ${msg || res.statusText}`);
        }
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) throw new Error("Empty PDF stream received.");

        // 2. Load PDF.js (client-side only, avoid SSR)
        const pdfjsLib = await import("pdfjs-dist");

        // 3. Configure worker — use the static asset we'll copy to /public
        //    Falls back to a no-op fake worker (slower but works without worker setup)
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        // 4. Open the PDF from raw bytes — most reliable across all PDF.js versions
        const doc = await pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist/cmaps/",
          cMapPacked: true,
        }).promise;

        if (!cancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setCurrentPage(1);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("[PdfViewer] load error:", err);
          setLoadError(err?.message || "Failed to load PDF document.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [src]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;

    // Cancel any in-progress render first
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch { /* ignore */ }
      renderTaskRef.current = null;
    }

    try {
      setRendering(true);
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
    } catch (err: any) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("[PdfViewer] render error:", err);
      }
    } finally {
      setRendering(false);
      renderTaskRef.current = null;
    }
  }, [pdfDoc, scale]);

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage);
  }, [pdfDoc, currentPage, renderPage]);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-amber-500" />
        <span className="text-sm">Decrypting and rendering PDF...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground px-4">
        <AlertCircle className="size-8 text-amber-500" />
        <span className="text-sm text-center max-w-sm">{loadError}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-black/5 dark:bg-white/5 shrink-0 rounded-t-2xl">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, parseFloat((s - 0.2).toFixed(1))))}
            disabled={scale <= 0.5}
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-40 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <span className="text-[11px] font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3, parseFloat((s + 0.2).toFixed(1))))}
            disabled={scale >= 3}
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-40 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="size-3.5" />
          </button>
        </div>

        <span className="text-[11px] font-mono opacity-60 truncate max-w-[180px]">
          {title || "PDF Document"}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || rendering}
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-[11px] font-mono px-1 whitespace-nowrap">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages || rendering}
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-zinc-200/60 dark:bg-zinc-900/60 rounded-b-2xl">
        <div className="relative shadow-xl rounded-sm">
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-black/40 rounded-sm z-10">
              <Loader2 className="size-5 animate-spin text-amber-500" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="block max-w-full rounded-sm"
            style={{ userSelect: "none", WebkitUserSelect: "none" }}
          />
        </div>
      </div>
    </div>
  );
}
