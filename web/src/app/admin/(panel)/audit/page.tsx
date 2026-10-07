"use client";

import { useEffect, useState } from "react";
import {
  ScrollText,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  Shield,
  User,
  Clock,
  Code,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";

interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: any;
  ip: string | null;
  created_at: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  async function loadLogs() {
    try {
      setLoading(true);
      setError(null);
      const res = await api<{ total: number; logs: AuditLogEntry[] }>("/admin/audit?limit=100");
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      (log.actor_name && log.actor_name.toLowerCase().includes(term)) ||
      (log.actor_email && log.actor_email.toLowerCase().includes(term)) ||
      (log.entity_type && log.entity_type.toLowerCase().includes(term)) ||
      (log.entity_id && log.entity_id.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-medium tracking-tight">Audit Trail & System Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Immutable log of every privileged action, settlement execution, and terms agreement (§10).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
          <RefreshCw className="size-3.5 mr-1.5" /> Refresh Log
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2 text-sm">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by action, actor, or entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-line bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="text-xs font-mono text-muted-foreground self-center">
          Showing {filteredLogs.length} of {total} recorded events
        </div>
      </div>

      {/* Audit Logs Table */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading immutable audit trail...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-12 text-center space-y-3">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <ScrollText className="size-6" />
          </div>
          <h3 className="font-serif font-medium text-lg">No audit events match query</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Try adjusting your search query or trigger an administrative action.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border/60 text-xs text-muted-foreground uppercase font-mono">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Actor</th>
                  <th className="px-5 py-3.5">Target Entity</th>
                  <th className="px-5 py-3.5">IP Address</th>
                  <th className="px-5 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredLogs.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString("en-KE", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-500/20">
                        {item.action}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {item.actor_name ? (
                        <div>
                          <div className="font-medium text-foreground">{item.actor_name}</div>
                          <div className="text-muted-foreground font-mono">{item.actor_email}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-mono">System / Anonymous</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs font-mono">
                      {item.entity_type ? (
                        <span className="text-foreground">
                          {item.entity_type}:{item.entity_id ? item.entity_id.slice(0, 8) : "—"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-muted-foreground">
                      {item.ip || "127.0.0.1"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(item)}
                        title="Inspect Metadata"
                      >
                        <Eye className="size-3.5 mr-1" /> Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Metadata Inspector */}
      <Modal
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={`Audit Event Details: ${selectedLog?.action}`}
        description={`Event ID: ${selectedLog?.id} · Logged at ${selectedLog ? new Date(selectedLog.created_at).toLocaleString() : ""}`}
        footer={
          <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1">
              <span className="text-muted-foreground block font-mono uppercase">Actor</span>
              <p className="font-semibold text-foreground">{selectedLog?.actor_name || "System"}</p>
              <p className="text-muted-foreground font-mono">{selectedLog?.actor_email || "N/A"}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1">
              <span className="text-muted-foreground block font-mono uppercase">Target Entity</span>
              <p className="font-semibold text-foreground">{selectedLog?.entity_type || "N/A"}</p>
              <p className="text-muted-foreground font-mono">{selectedLog?.entity_id || "N/A"}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Code className="size-3.5" /> Event Metadata Payload
            </span>
            <pre className="p-3.5 rounded-xl bg-ink-950 text-emerald-400 font-mono text-xs overflow-x-auto max-h-60 border border-line">
              {JSON.stringify(selectedLog?.metadata || {}, null, 2)}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  );
}
