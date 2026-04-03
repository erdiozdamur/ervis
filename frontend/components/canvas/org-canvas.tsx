'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Connection,
  Controls,
  Edge,
  EdgeChange,
  MarkerType,
  MiniMap,
  Node,
  NodeChange,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { EdgeType, EntityStatus } from '@prisma/client';
import { signOut } from 'next-auth/react';
import { ActivityLogPanel } from '@/components/activity-log-panel';
import { TeamNode } from '@/components/canvas/team-node';
import { OrganizationEditorPanel } from '@/components/organization-editor-panel';
import { TeamEditorPanel } from '@/components/team-editor-panel';
import { Button } from '@/components/ui/button';
import { layoutNodesAsGrid } from '@/lib/canvas-layout';
import { ArrowLeft, LayoutGrid, ListTree, Logs, Maximize2, Plus, Search, ZoomIn } from 'lucide-react';

const nodeTypes = {
  team: ({ id, data, selected }: { id: string; data: { name: string; onEdit?: () => void }; selected: boolean }) => (
    <TeamNode teamId={id} name={data.name} selected={selected} onEdit={data.onEdit} />
  ),
};

type OrgCanvasProps = {
  initialNodes: Node[];
  initialEdges: Edge[];
  organizationId: string;
  organization: {
    id: string;
    name: string;
    description: string;
    status: EntityStatus;
    tags: string[];
    instructions: string;
    attributes: unknown;
  };
  teams: Array<{ id: string; name: string }>;
  logs: Array<{ id: string; action: string; subjectType: string; createdAt: string | Date }>;
};

export function OrgCanvas({ initialNodes, initialEdges, organizationId, organization, teams, logs }: OrgCanvasProps) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [adding, setAdding] = useState(false);
  const [autoLayouting, setAutoLayouting] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showTeamsPanel, setShowTeamsPanel] = useState(false);
  const [showLogsPanel, setShowLogsPanel] = useState(false);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);

  const visibleNodes = useMemo(
    () =>
      nodes
        .filter((n) => String((n.data as { name?: string }).name ?? '').toLowerCase().includes(search.toLowerCase()))
        .map((n) => ({
          ...n,
          data: {
            ...(n.data as object),
            onEdit: () => setEditingTeamId(n.id),
          },
          selected: n.id === selectedNodeId,
        })),
    [nodes, search, selectedNodeId],
  );

  const onConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    setEdges((eds) => addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed }, data: { edgeType: EdgeType.HIERARCHY } }, eds));
    await fetch('/api/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'team', organizationId, sourceId: connection.source, targetId: connection.target, edgeType: 'HIERARCHY' }),
    });
  };

  const onNodeDragStop = async (_: unknown, node: Node) => {
    setNodes((nds) => nds.map((n) => (n.id === node.id ? node : n)));
    await fetch('/api/teams', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: node.id, positionX: node.position.x, positionY: node.position.y }),
    });
  };

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setAdding(true);
    await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, name: newTeamName.trim() }),
    });
    setAdding(false);
    setNewTeamName('');
    window.location.reload();
  };

  const runAutoLayout = async () => {
    setAutoLayouting(true);
    const sorted = [...nodes].sort((a, b) => String((a.data as { name?: string }).name ?? '').localeCompare(String((b.data as { name?: string }).name ?? '')));
    const positioned = layoutNodesAsGrid(sorted);
    setNodes(positioned);
    await Promise.all(positioned.map((node) => fetch('/api/teams', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: node.id, positionX: node.position.x, positionY: node.position.y }),
    })));
    flow?.fitView({ padding: 0.2, duration: 500 });
    setAutoLayouting(false);
  };

  const editingTeam = editingTeamId ? nodes.find((n) => n.id === editingTeamId) : null;

  return (
    <section className="relative h-full w-full overflow-hidden bg-slate-950/70">
      <ReactFlow
        nodes={visibleNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onNodeDragStop={onNodeDragStop}
        onInit={setFlow}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        panOnScroll
        selectionOnDrag
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#38bdf8', strokeWidth: 1.6 } }}
      >
        <MiniMap pannable zoomable className="!bg-slate-950/85" nodeColor="#38bdf8" maskColor="rgba(2,6,23,0.6)" />
        <Controls className="!border-white/15 !bg-slate-900/85" />
        <Background color="rgba(148,163,184,0.22)" gap={22} />
      </ReactFlow>

      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="pointer-events-auto absolute left-4 top-4 w-[min(560px,calc(100vw-2rem))] rounded-2xl border border-white/12 bg-slate-950/88 p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-200/80">Organization Canvas</div>
              <h2 className="text-base font-semibold text-white">{organization.name}</h2>
              <div className="mt-1 text-xs text-slate-400">{nodes.length} teams · {edges.length} hierarchy edges</div>
            </div>
            <Link href="/dashboard">
              <Button type="button" variant="secondary" size="sm" className="rounded-lg">
                <ArrowLeft size={14} />
                Dashboard
              </Button>
            </Link>
          </div>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="field pl-9" placeholder="Search teams" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="pointer-events-auto absolute right-4 top-4 flex max-w-[calc(100vw-2rem)] flex-wrap justify-end gap-2">
          <OrganizationEditorPanel organization={organization} triggerLabel="Organization" triggerClassName="rounded-lg" />
          <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={() => setShowAddPanel((v) => !v)}>
            <Plus size={14} />
            Add Team
          </Button>
          <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={() => setShowTeamsPanel((v) => !v)}>
            <ListTree size={14} />
            Teams
          </Button>
          <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={() => setShowLogsPanel((v) => !v)}>
            <Logs size={14} />
            Activity
          </Button>
          <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={() => flow?.zoomIn({ duration: 200 })}><ZoomIn size={14} />Zoom</Button>
          <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={() => flow?.fitView({ padding: 0.2, duration: 300 })}><Maximize2 size={14} />Fit</Button>
          <Button type="button" variant="secondary" size="sm" className="rounded-lg" disabled={autoLayouting} onClick={runAutoLayout}><LayoutGrid size={14} />{autoLayouting ? 'Layout...' : 'Auto Layout'}</Button>
          <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</Button>
        </div>

        {showAddPanel ? (
          <div className="pointer-events-auto absolute right-4 top-[4.5rem] w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-white/12 bg-slate-950/92 p-3 shadow-2xl backdrop-blur-xl">
            <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Create Team</div>
            <div className="flex gap-2">
              <input
                className="field"
                placeholder="Team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void createTeam();
                  }
                }}
              />
              <Button type="button" size="sm" className="rounded-lg" disabled={adding || !newTeamName.trim()} onClick={createTeam}>
                {adding ? 'Adding' : 'Add'}
              </Button>
            </div>
          </div>
        ) : null}

        {showTeamsPanel ? (
          <div className="pointer-events-auto absolute left-4 bottom-4 w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-white/12 bg-slate-950/92 p-3 shadow-2xl backdrop-blur-xl">
            <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Team Shortcuts</div>
            <div className="max-h-52 space-y-2 overflow-auto pr-1">
              {teams.length ? teams.map((team) => (
                <Link key={team.id} href={`/team/${team.id}`} className="block rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
                  {team.name}
                </Link>
              )) : <div className="text-xs text-slate-500">No team yet.</div>}
            </div>
          </div>
        ) : null}

        {showLogsPanel ? (
          <div className="pointer-events-auto absolute bottom-4 right-4 w-[min(540px,calc(100vw-2rem))]">
            <ActivityLogPanel logs={logs} className="h-[320px]" />
          </div>
        ) : null}
      </div>

      {editingTeam ? (
        <TeamEditorPanel
          open
          team={{
            id: editingTeam.id,
            organizationId,
            name: String((editingTeam.data as { name?: string }).name ?? ''),
            instructions: String((editingTeam.data as { instructions?: string }).instructions ?? ''),
          }}
          onClose={() => setEditingTeamId(null)}
          onSaved={() => window.location.reload()}
        />
      ) : null}
    </section>
  );
}
