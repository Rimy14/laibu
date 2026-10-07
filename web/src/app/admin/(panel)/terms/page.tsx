"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader, Panel } from "@/components/shell/dashboard-shell";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog";
import { Alert, Badge } from "@/components/ui/feedback";
import { Field, TextArea } from "@/components/ui/field";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";

interface Version {
  id: string;
  doc: "terms_of_use" | "privacy_policy";
  version: string;
  title: string;
  is_current: boolean;
  published_at: string;
  acceptances: number;
}

const DOC_LABEL = { terms_of_use: "Terms of Use", privacy_policy: "Privacy Policy" } as const;

export default function TermsVersionsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doc, setDoc] = useState<Version["doc"]>("terms_of_use");
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("Terms of Use");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<Version[]>("/admin/terms")
      .then(setVersions)
      .catch((e: ApiError) => setLoadError(e.message));
  }, []);
  useEffect(load, [load]);

  const publish = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (!/^[0-9A-Za-z.\-]{1,20}$/.test(version)) v.version = "Use something like 1.1 or 2026-11.";
    if (title.trim().length < 2) v.title = "Enter a title.";
    if (content.trim().length < 20) v.content = "Paste the full document text.";
    setErrors(v);
    if (Object.keys(v).length) return;

    const ok = await confirm({
      title: `Publish ${DOC_LABEL[doc]} ${version}?`,
      description: "Every user will have to read and accept it before they can continue using Laibu. Published versions can't be edited.",
      confirmText: "Publish",
      tone: "danger",
      confirmPhrase: "PUBLISH",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await api("/admin/terms", { method: "POST", body: { doc, version, title, content_md: content } });
      toast.success(`${DOC_LABEL[doc]} ${version} published`, { description: "Users will be asked to accept it on their next visit." });
      setVersion("");
      setContent("");
      load();
    } catch (err) {
      toast.error("Couldn't publish", { description: (err as ApiError).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Terms versions" description="The documents every user accepts. Each acceptance is kept as contract evidence." />

      <div className="grid gap-8">
        <Panel title="Published versions">
          {loadError ? (
            <Alert tone="danger" title={loadError} />
          ) : !versions ? (
            <TableSkeleton rows={3} cols={4} />
          ) : (
            <div className="-mx-5 overflow-x-auto sm:-mx-6">
              <table className="w-full text-left text-sm">
                <thead className="text-ink-500">
                  <tr className="border-b border-line">
                    <th className="px-5 py-2.5 font-normal sm:px-6">Document</th>
                    <th className="px-3 py-2.5 font-normal">Version</th>
                    <th className="px-3 py-2.5 font-normal">Published</th>
                    <th className="px-3 py-2.5 text-right font-normal">Acceptances</th>
                    <th className="px-5 py-2.5 sm:px-6" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {versions.map((v) => (
                    <tr key={v.id}>
                      <td className="px-5 py-3 sm:px-6">{DOC_LABEL[v.doc]}</td>
                      <td className="px-3 py-3 font-mono text-xs">{v.version}</td>
                      <td className="px-3 py-3 text-ink-500">{new Date(v.published_at).toLocaleDateString("en-KE", { dateStyle: "medium" })}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{v.acceptances}</td>
                      <td className="px-5 py-3 text-right sm:px-6">{v.is_current && <Badge tone="success">Current</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Publish a new version" description="Paste the final text from your lawyer. It replaces the current version immediately.">
          <form onSubmit={publish} noValidate className="grid max-w-2xl gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="doc" className="text-sm font-medium">
                Document
              </label>
              <select
                id="doc"
                value={doc}
                onChange={(e) => {
                  const d = e.target.value as Version["doc"];
                  setDoc(d);
                  setTitle(DOC_LABEL[d]);
                }}
                className="h-11 rounded-md border border-line bg-white px-3 outline-none focus:border-ink-700 focus:ring-3 focus:ring-ink-900/8"
              >
                <option value="terms_of_use">Terms of Use</option>
                <option value="privacy_policy">Privacy Policy</option>
              </select>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.1" error={errors.version} required />
              <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} required />
            </div>
            <TextArea
              label="Document text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              error={errors.content}
              rows={10}
              hint="Plain text. Leave a blank line between paragraphs."
            />
            <div>
              <Button type="submit" variant="dark" loading={saving} loadingText="Publishing…">
                Publish version
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
