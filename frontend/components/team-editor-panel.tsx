'use client';

import { useCallback, useEffect, useState } from 'react';
import { ContextSourceType } from '@prisma/client';
import { Database, FolderInput, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DrawerSection, DrawerShell } from '@/components/ui/drawer-shell';

type TeamEditorPanelProps = {
  open: boolean;
  team: {
    id: string;
    organizationId: string;
    name: string;
    instructions: string;
  };
  onClose: () => void;
  onSaved: () => void;
};

type ContextSourceListItem = {
  id: string;
  title: string;
  type: ContextSourceType;
  metadata?: { fileName?: string };
};

export function TeamEditorPanel({ open, team, onClose, onSaved }: TeamEditorPanelProps) {
  const [name, setName] = useState(team.name);
  const [instructions, setInstructions] = useState(team.instructions ?? '');
  const [sources, setSources] = useState<ContextSourceListItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setName(team.name);
    setInstructions(team.instructions ?? '');
  }, [team.id, team.instructions, team.name]);

  const loadSources = useCallback(async () => {
    const res = await fetch(`/api/context-sources/view?ownerType=TEAM&ownerId=${team.id}`);
    if (!res.ok) return;
    const payload = await res.json();
    setSources(Array.isArray(payload?.direct) ? payload.direct : []);
  }, [team.id]);

  useEffect(() => {
    if (!open) return;
    void loadSources();
  }, [loadSources, open]);

  const saveTeam = async () => {
    setSaving(true);
    setFeedback('');
    try {
      const res = await fetch('/api/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id, name, instructions }),
      });
      if (!res.ok) throw new Error('Team could not be updated.');
      onSaved();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Save failed.');
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
      formData.append('teamId', team.id);
      formData.append('file', selectedFile);
      const res = await fetch('/api/teams/context-document', { method: 'POST', body: formData });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Upload failed.');
      }
      setSelectedFile(null);
      await loadSources();
      setFeedback('Document uploaded.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      title="Team Settings"
      subtitle="Takım kimliği, talimatları ve bağlam dokümanları"
      footer={(
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">{feedback || 'Takım ayarları kanvasta anında güncellenir.'}</p>
          <Button type="button" disabled={saving} onClick={saveTeam}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    >
      <DrawerSection title="General" description="Takım adı ve çalışma talimatlarını güncelleyin.">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Team Name</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Instructions</label>
          <textarea className="field-area" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Write team instructions..." />
        </div>
      </DrawerSection>

      <DrawerSection title="Knowledge Base" description="Yüklenen dokümanlar takım bağlamına vektörlenerek eklenir.">
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
          <div className="mt-2">
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

      <DrawerSection title="Future Modules" description="Yeni takım modülleri için ayrılmış genişleme alanı.">
        <div className="rounded-xl border border-dashed border-cyan-300/30 bg-cyan-400/5 p-3 text-xs text-cyan-100/80">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <Sparkles size={14} />
            Reserved Slots
          </div>
          SLA hedefleri, takım çalışma pencereleri, handoff politikaları ve kalite skorları burada yönetilecek.
        </div>
      </DrawerSection>
    </DrawerShell>
  );
}
