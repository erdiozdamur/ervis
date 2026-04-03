'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ContextSourceType, EntityStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';

type OrganizationEditorPanelProps = {
  organization: {
    id: string;
    name: string;
    description: string;
    status: EntityStatus;
    tags: string[];
    instructions: string;
    attributes: unknown;
  };
};

type ContextSourceListItem = {
  id: string;
  title: string;
  type: ContextSourceType;
  metadata?: { fileName?: string; mimeType?: string; uploadedAt?: string };
};

export function OrganizationEditorPanel({ organization }: OrganizationEditorPanelProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(organization.name);
  const [instructions, setInstructions] = useState(organization.instructions ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sources, setSources] = useState<ContextSourceListItem[]>([]);
  const [feedback, setFeedback] = useState<string>('');

  const patchPayload = useMemo(
    () => ({
      organizationId: organization.id,
      name,
      description: organization.description ?? '',
      status: organization.status,
      tags: organization.tags ?? [],
      instructions,
      attributes: JSON.stringify(organization.attributes ?? {}),
    }),
    [instructions, name, organization],
  );

  const loadSources = useCallback(async () => {
    const res = await fetch(`/api/context-sources/view?ownerType=ORGANIZATION&ownerId=${organization.id}`);
    if (!res.ok) return;
    const data = await res.json();
    const direct = Array.isArray(data?.direct) ? data.direct : [];
    setSources(direct);
  }, [organization.id]);

  useEffect(() => {
    if (!open) return;
    void loadSources();
  }, [loadSources, open]);

  const saveOrganization = async () => {
    setSaving(true);
    setFeedback('');
    try {
      const res = await fetch('/api/organizations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      });
      if (!res.ok) throw new Error('Organization could not be updated.');
      setFeedback('Organization updated.');
      window.location.reload();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setFeedback('');
    try {
      const formData = new FormData();
      formData.append('organizationId', organization.id);
      formData.append('file', selectedFile);

      const res = await fetch('/api/organizations/context-document', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Document upload failed.');
      }

      setSelectedFile(null);
      setFeedback('Document uploaded and vectorized.');
      await loadSources();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>Edit Organization</Button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close panel" className="absolute inset-0 bg-slate-950/35" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Organization Settings</h2>
              <Button type="button" className="bg-slate-200 text-slate-900" onClick={() => setOpen(false)}>Close</Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Organization Name</label>
                <input className="h-10 w-full rounded-md border px-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Organization name" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Instructions</label>
                <textarea className="min-h-40 w-full rounded-md border p-3 text-sm" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Write organization instructions..." />
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Context Document Upload</div>
                <input
                  type="file"
                  className="mb-2 block w-full text-sm"
                  accept=".txt,.md,.markdown,.json,.csv,.log,.text,application/json,text/plain,text/markdown,text/csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                <div className="mb-2 text-xs text-slate-500">Uploaded content is embedded and stored in pgvector for this organization.</div>
                <Button type="button" disabled={!selectedFile || uploading} onClick={uploadDocument}>
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </Button>
                <div className="mt-3 space-y-2">
                  {sources.length ? sources.map((source) => (
                    <div key={source.id} className="rounded border p-2 text-xs">
                      <div className="font-medium">{source.title}</div>
                      <div className="text-slate-500">{source.metadata?.fileName ?? source.type}</div>
                    </div>
                  )) : <div className="text-xs text-slate-500">No context documents yet.</div>}
                </div>
              </div>

              {feedback ? <p className="text-xs text-slate-600">{feedback}</p> : null}

              <div className="flex gap-2">
                <Button type="button" disabled={saving} onClick={saveOrganization}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
