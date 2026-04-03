'use client';

import { useEffect, useMemo, useState } from 'react';
import { ContextOwnerType, ContextSourceType, EdgeType, EntityStatus, ModelPreference } from '@prisma/client';
import { Button } from '@/components/ui/button';

type SelectedEntity = {
  kind: 'organization' | 'team' | 'employee';
  id: string;
  organizationId: string;
  teamId?: string;
  name: string;
  description?: string;
  status?: EntityStatus;
  tags?: string[];
  instructions?: string;
  attributes?: Record<string, unknown>;
  modelPreference?: ModelPreference;
};

type ContextView = {
  inheritedFromOrganization: Array<{ id: string; title: string; type: string }>;
  inheritedFromTeam: Array<{ id: string; title: string; type: string }>;
  direct: Array<{ id: string; title: string; type: string; content: string; metadata: unknown }>;
};

export function PropertiesPanel({ entity, edges, refresh }: { entity?: SelectedEntity; edges: Array<{ id: string; label: string | null; edgeType: EdgeType; description: string; conditionNote: string }>; refresh: () => void }) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [context, setContext] = useState<ContextView | null>(null);
  const [allCapabilities, setAllCapabilities] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCapabilityIds, setSelectedCapabilityIds] = useState<string[]>([]);
  const [effectiveCaps, setEffectiveCaps] = useState<Array<{ key: string; label: string }>>([]);

  useEffect(() => {
    if (!entity) return;
    setForm({
      name: entity.name,
      description: entity.description ?? '',
      status: entity.status ?? 'ACTIVE',
      tags: (entity.tags ?? []).join(', '),
      instructions: entity.instructions ?? '',
      attributes: JSON.stringify(entity.attributes ?? {}, null, 2),
      modelPreference: entity.modelPreference ?? 'GPT_4O_MINI',
    });
  }, [entity]);

  useEffect(() => {
    if (!entity) return;
    fetch(`/api/capabilities${entity.kind === 'employee' ? `?employeeId=${entity.id}` : entity.kind === 'team' ? `?teamId=${entity.id}` : ''}`).then((r) => r.json()).then((data) => {
      setAllCapabilities(data.capabilities ?? []);
      setSelectedCapabilityIds(data.assignedCapabilityIds ?? []);
      setEffectiveCaps(data.effective ?? []);
    });

    const ownerType: ContextOwnerType = entity.kind === 'organization' ? 'ORGANIZATION' : entity.kind === 'team' ? 'TEAM' : 'EMPLOYEE';
    fetch(`/api/context-sources/view?ownerType=${ownerType}&ownerId=${entity.id}`).then((r) => r.json()).then((data) => setContext(data));
  }, [entity]);

  const ownerType = useMemo<ContextOwnerType | null>(() => (entity ? (entity.kind === 'organization' ? 'ORGANIZATION' : entity.kind === 'team' ? 'TEAM' : 'EMPLOYEE') : null), [entity]);

  if (!entity) return <aside className="w-80 border-l p-3 text-sm text-muted-foreground">Select a node to edit properties.</aside>;

  const save = async () => {
    if (entity.kind === 'organization') {
      await fetch('/api/organizations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: entity.id, ...form, tags: String(form.tags ?? '').split(',').map((x) => x.trim()).filter(Boolean) }),
      });
    } else if (entity.kind === 'team') {
      await fetch('/api/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: entity.id, name: String(form.name ?? ''), instructions: String(form.instructions ?? '') }),
      });
      await fetch('/api/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'team', teamId: entity.id, capabilityIds: selectedCapabilityIds }),
      });
    } else if (entity.kind === 'employee') {
      await fetch('/api/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: entity.id, name: String(form.name ?? ''), instructions: String(form.instructions ?? ''), modelPreference: String(form.modelPreference ?? 'GPT_4O_MINI') }),
      });
      await fetch('/api/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'employee', employeeId: entity.id, capabilityIds: selectedCapabilityIds }),
      });
    }
    refresh();
  };

  return (
    <aside className="w-80 space-y-3 overflow-auto border-l p-3 text-xs">
      <h3 className="font-semibold">Properties</h3>
      <input className="w-full rounded border px-2 py-1" value={String(form.name ?? '')} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Name" />
      <textarea className="h-16 w-full rounded border px-2 py-1" value={String(form.description ?? '')} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} placeholder="Description" />
      <select className="w-full rounded border px-2 py-1" value={String(form.status ?? 'ACTIVE')} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}>
        <option value="ACTIVE">ACTIVE</option><option value="ARCHIVED">ARCHIVED</option>
      </select>
      {entity.kind !== 'team' ? <input className="w-full rounded border px-2 py-1" value={String(form.tags ?? '')} onChange={(e) => setForm((v) => ({ ...v, tags: e.target.value }))} placeholder="Tags comma-separated" /> : null}
      <textarea className="h-16 w-full rounded border px-2 py-1" value={String(form.instructions ?? '')} onChange={(e) => setForm((v) => ({ ...v, instructions: e.target.value }))} placeholder="Instructions" />
      {entity.kind !== 'team' ? <textarea className="h-20 w-full rounded border px-2 py-1 font-mono" value={String(form.attributes ?? '{}')} onChange={(e) => setForm((v) => ({ ...v, attributes: e.target.value }))} placeholder="Attributes JSON" /> : null}

      {entity.kind === 'team' ? (
        <div className="space-y-1 rounded border p-2">
          <div className="font-semibold">Default capabilities</div>
          {allCapabilities.map((cap) => (
            <label key={cap.id} className="flex items-center gap-2">
              <input type="checkbox" checked={selectedCapabilityIds.includes(cap.id)} onChange={(e) => setSelectedCapabilityIds((prev) => (e.target.checked ? [...new Set([...prev, cap.id])] : prev.filter((id) => id !== cap.id)))} />
              {cap.label}
            </label>
          ))}
        </div>
      ) : null}


      {entity.kind === 'employee' ? (
        <>
          <select className="w-full rounded border px-2 py-1" value={String(form.modelPreference ?? 'GPT_4O_MINI')} onChange={(e) => setForm((v) => ({ ...v, modelPreference: e.target.value }))}>
            <option value="GPT_4_1">GPT_4_1</option>
            <option value="GPT_4O">GPT_4O</option>
            <option value="GPT_4O_MINI">GPT_4O_MINI</option>
          </select>

          <div className="space-y-1 rounded border p-2">
            <div className="font-semibold">Capabilities</div>
            {allCapabilities.map((cap) => (
              <label key={cap.id} className="flex items-center gap-2">
                <input type="checkbox" checked={selectedCapabilityIds.includes(cap.id)} onChange={(e) => setSelectedCapabilityIds((prev) => (e.target.checked ? [...new Set([...prev, cap.id])] : prev.filter((id) => id !== cap.id)))} />
                {cap.label}
              </label>
            ))}
            <div className="text-muted-foreground">Effective: {effectiveCaps.map((c) => c.label).join(', ') || 'None'}</div>
          </div>
        </>
      ) : null}

      <div className="space-y-1 rounded border p-2">
        <div className="font-semibold">Context sources</div>
        {context?.inheritedFromOrganization.length ? <div>Inherited from organization: {context.inheritedFromOrganization.map((c) => c.title).join(', ')}</div> : null}
        {context?.inheritedFromTeam.length ? <div>Inherited from team: {context.inheritedFromTeam.map((c) => c.title).join(', ')}</div> : null}
        {context?.direct.length ? <div>Direct: {context.direct.map((c) => c.title).join(', ')}</div> : <div className="text-muted-foreground">No direct context.</div>}
        <Button type="button" onClick={async () => {
          if (!ownerType) return;
          await fetch('/api/context-sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId: entity.organizationId, ownerType, ownerId: entity.id, title: 'New note', type: ContextSourceType.NOTE, content: 'Edit me', metadata: '{}' }) });
          refresh();
        }}>Add Context</Button>
      </div>

      <div className="space-y-1 rounded border p-2">
        <div className="font-semibold">Edges ({edges.length})</div>
        {edges.map((edge) => (
          <div key={edge.id} className="rounded border p-2">
            <div>{edge.edgeType}</div>
            <input className="mt-1 w-full rounded border px-1 py-0.5" defaultValue={edge.label ?? ''} onBlur={async (e) => {
              await fetch('/api/edges', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edgeId: edge.id, kind: entity.kind === 'employee' ? 'employee' : 'team', edgeType: edge.edgeType, label: e.target.value, description: edge.description, conditionNote: edge.conditionNote }) });
              refresh();
            }} placeholder="Edge label" />
            <select className="mt-1 w-full rounded border px-1 py-0.5" defaultValue={edge.edgeType} onChange={async (e) => {
              await fetch('/api/edges', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edgeId: edge.id, kind: entity.kind === 'employee' ? 'employee' : 'team', edgeType: e.target.value, label: edge.label, description: edge.description, conditionNote: edge.conditionNote }) });
              refresh();
            }}>
              {Object.values(EdgeType).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <Button type="button" className="mt-1 bg-red-500" onClick={async () => { await fetch('/api/edges', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edgeId: edge.id, kind: entity.kind === 'employee' ? 'employee' : 'team' }) }); refresh(); }}>Delete edge</Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={save}>Save</Button>
      </div>
    </aside>
  );
}
