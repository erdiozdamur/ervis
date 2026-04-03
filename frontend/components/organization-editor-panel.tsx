'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ContextSourceType, EntityStatus } from '@prisma/client';
import { Database, FolderInput, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DrawerSection, DrawerShell } from '@/components/ui/drawer-shell';
import { cn } from '@/lib/utils';

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
  triggerClassName?: string;
  triggerLabel?: string;
};

type ContextSourceListItem = {
  id: string;
  title: string;
  type: ContextSourceType;
  metadata?: { fileName?: string; mimeType?: string; uploadedAt?: string };
};

export function OrganizationEditorPanel({ organization, triggerClassName, triggerLabel }: OrganizationEditorPanelProps) {
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
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={cn('rounded-lg', triggerClassName)}
        onClick={() => setOpen(true)}
      >
        {triggerLabel ?? 'Edit Organization'}
      </Button>

      <DrawerShell
        open={open}
        onClose={() => setOpen(false)}
        title="Organization Settings"
        subtitle="Temel kimlik, çalışma talimatları ve organizasyon bağlamı"
        footer={(
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">{feedback || 'Değişiklikler kaydedildiğinde tüm kanvasa yansır.'}</p>
            <Button type="button" disabled={saving} onClick={saveOrganization}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      >
        <DrawerSection title="General" description="Organizasyon adı ve global çalışma talimatları">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Organization Name</label>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Organization name" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Instructions</label>
            <textarea className="field-area" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Write organization instructions..." />
          </div>
        </DrawerSection>

        <DrawerSection title="Knowledge Base" description="Yüklenen dokümanlar vektöre dönüştürülerek organization seviyesinde saklanır.">
          <div className="rounded-xl border border-white/12 bg-white/5 p-3">
            <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
              <FolderInput size={14} />
              Context Document Upload
            </label>
            <input
              type="file"
              className="field h-auto py-2"
              accept=".txt,.md,.markdown,.json,.csv,.log,.text,application/json,text/plain,text/markdown,text/csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" disabled={!selectedFile || uploading} onClick={uploadDocument}>
                <Database size={14} />
                {uploading ? 'Uploading...' : 'Upload & Vectorize'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {sources.length ? sources.map((source) => (
              <div key={source.id} className="rounded-xl border border-white/12 bg-slate-950/60 p-3 text-xs">
                <div className="font-medium text-slate-100">{source.title}</div>
                <div className="mt-1 text-slate-400">{source.metadata?.fileName ?? source.type}</div>
              </div>
            )) : <div className="rounded-xl border border-dashed border-white/20 p-3 text-xs text-slate-400">No context documents yet.</div>}
          </div>
        </DrawerSection>

        <DrawerSection title="Future Modules" description="Yeni alanlar geldiğinde düzen bozulmadan genişleyebilmek için ayrılan blok.">
          <div className="rounded-xl border border-dashed border-cyan-300/30 bg-cyan-400/5 p-3 text-xs text-cyan-100/80">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <Sparkles size={14} />
              Reserved Slots
            </div>
            Policy packs, guardrails, routing profiles ve organization-level automations burada konumlanacak.
          </div>
        </DrawerSection>
      </DrawerShell>
    </>
  );
}
