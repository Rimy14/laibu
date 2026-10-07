"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  Search,
  RefreshCw,
  AlertCircle,
  Smartphone,
  Eye,
  Camera,
  Printer,
  Copy,
  Terminal,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface SecurityEventEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  book_id: string | null;
  book_title: string | null;
  event_type: string;
  page: string | null;
  device_label: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function AdminSecurityPage() {
  const [events, setEvents] = useState<SecurityEventEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  async function loadEvents() {
    try {
      setLoading(true);
      setError(null);
      const res = await api<{ total: number; events: SecurityEventEntry[] }>("/admin/security-events?limit=100");
      setEvents(res.events);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load security events.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  const filteredEvents = events.filter((ev) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      ev.event_type.toLowerCase().includes(term) ||
      (ev.user_name && ev.user_name.toLowerCase().includes(term)) ||
      (ev.user_email && ev.user_email.toLowerCase().includes(term)) ||
      (ev.book_title && ev.book_title.toLowerCase().includes(term)) ||
      (ev.ip && ev.ip.includes(term))
    );
  });

  function getEventBadge(eventType: string) {
    switch (eventType) {
      case "screenshot_key":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
            <Camera className="size-3.5" /> Screenshot Key (PrintScreen)
          </span>
        );
      case "print_attempt":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
            <Printer className="size-3.5" /> Print Attempt (Ctrl+P)
          </span>
        );
      case "copy_attempt":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <Copy className="size-3.5" /> Clipboard Copy Attempt
          </span>
        );
      case "devtools_open":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <Terminal className="size-3.5" /> DevTools Inspection
          </span>
        );
      case "window_blur":
      case "tab_hidden":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <Eye className="size-3.5" /> Window Blur / Screen Mask
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
            {eventType}
          </span>
        );
    }
  }

  const screenshotCount = events.filter((e) => e.event_type === "screenshot_key" || e.event_type === "print_attempt").length;
  const copyCount = events.filter((e) => e.event_type === "copy_attempt").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-medium tracking-tight">DRM Security Events Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time feed of screen capture attempts, clipboard copy blocks, and print prevention events (§6).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadEvents} disabled={loading}>
          <RefreshCw className="size-3.5 mr-1.5" /> Refresh Feed
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2 text-sm">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-1 shadow-xs bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-800/40">
          <span className="text-xs font-mono uppercase tracking-wider text-red-800 dark:text-red-400">
            Capture & Print Blocks
          </span>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-red-600 dark:text-red-400" />
            <span className="text-2xl font-serif font-semibold text-red-700 dark:text-red-300">
              {screenshotCount}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-1 shadow-xs bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40">
          <span className="text-xs font-mono uppercase tracking-wider text-amber-800 dark:text-amber-400">
            Clipboard Scraping Blocks
          </span>
          <div className="flex items-center gap-2">
            <Copy className="size-5 text-amber-600 dark:text-amber-400" />
            <span className="text-2xl font-serif font-semibold text-amber-700 dark:text-amber-300">
              {copyCount}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-1 shadow-xs bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40">
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
            DRM Watermark Status
          </span>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-2xl font-serif font-semibold text-emerald-700 dark:text-emerald-300">
              100% Active
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by event type, user, book title, or IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-line bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="text-xs font-mono text-muted-foreground self-center">
          Showing {filteredEvents.length} of {total} security intercepts
        </div>
      </div>

      {/* Security Events Table */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading security events...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-12 text-center space-y-3">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <ShieldAlert className="size-6" />
          </div>
          <h3 className="font-serif font-medium text-lg">No security capture events recorded yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            When users attempt screenshots, printing, or clipboard copying on the reader, events will stream here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border/60 text-xs text-muted-foreground uppercase font-mono">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Event Type</th>
                  <th className="px-5 py-3.5">Reader (Buyer)</th>
                  <th className="px-5 py-3.5">Protected Book</th>
                  <th className="px-5 py-3.5">Location</th>
                  <th className="px-5 py-3.5">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString("en-KE", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-4">
                      {getEventBadge(ev.event_type)}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {ev.user_name ? (
                        <div>
                          <div className="font-medium text-foreground">{ev.user_name}</div>
                          <div className="text-muted-foreground font-mono">{ev.user_email}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Anonymous Reader</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {ev.book_title ? (
                        <div>
                          <div className="font-medium text-foreground">{ev.book_title}</div>
                          <div className="text-muted-foreground">{ev.page || "Chapter View"}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs truncate" title={ev.device_label || ""}>
                      {ev.device_label || "Web Client"}
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-muted-foreground">
                      {ev.ip || "127.0.0.1"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
