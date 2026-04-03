'use client';

import { useCallback, useEffect, useState } from 'react';
import { ContextSourceType, ModelPreference } from '@prisma/client';
import { Button } from '@/components/ui/button';

type EmployeeEditorPanelProps = {
  open: boolean;
  employee: {
    id: string;
    teamId: string;
    organizationId: string;
    name: string;
    instructions: string;
    modelPreference: ModelPreference;
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

export function EmployeeEditorPanel({ open, employee, onClose, onSaved }: EmployeeEditorPanelProps) {
  const [name, setName] = useState(employee.name);
  const [instructions, setInstructions] = useState(employee.instructions ?? '');
  const [modelPreference, setModelPreference] = useState<ModelPreference>(employee.modelPreference);
  const [sources, setSources] = useState<ContextSourceListItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setName(employee.name);
    setInstructions(employee.instructions ?? '');
    setModelPreference(employee.modelPreference);
  }, [employee.id, employee.instructions, employee.modelPreference, employee.name]);

  const loadSources = useCallback(async () => {
    const res = await fetch(`/api/context-sources/view?ownerType=EMPLOYEE&ownerId=${employee.id}`);
    if (!res.ok) return;
    const payload = await res.json();
    setSources(Array.isArray(payload?.direct) ? payload.direct : []);
  }, [employee.id]);

  useEffect(() => {
    if (!open) return;
    void loadSources();
  }, [loadSources, open]);

  const saveEmployee = async () => {
    setSaving(true);
    setFeedback('');
    try {
      const res = await fetch('/api/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          name,
          instructions,
          modelPreference,
        }),
      });
      if (!res.ok) throw new Error('Employee could not be updated.');
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
      formData.append('employeeId', employee.id);
      formData.append('file', selectedFile);
      const res = await fetch('/api/employees/context-document', { method: 'POST', body: formData });
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close panel" className="absolute inset-0 bg-slate-950/35" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Employee Settings</h2>
          <Button type="button" className="bg-slate-200 text-slate-900" onClick={onClose}>Close</Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Employee Name</label>
            <input className="h-10 w-full rounded-md border px-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Instructions</label>
            <textarea className="min-h-40 w-full rounded-md border p-3 text-sm" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Write employee instructions..." />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Model</label>
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={modelPreference} onChange={(e) => setModelPreference(e.target.value as ModelPreference)}>
              <option value={ModelPreference.GPT_4_1}>GPT_4_1</option>
              <option value={ModelPreference.GPT_4O}>GPT_4O</option>
              <option value={ModelPreference.GPT_4O_MINI}>GPT_4O_MINI</option>
            </select>
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Context Document Upload</div>
            <input
              type="file"
              className="mb-2 block w-full text-sm"
              accept=".txt,.md,.markdown,.json,.csv,.log,.text,application/json,text/plain,text/markdown,text/csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            <div className="mb-2 text-xs text-slate-500">Uploaded content is embedded and stored in pgvector for this employee.</div>
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
            <Button type="button" disabled={saving} onClick={saveEmployee}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

