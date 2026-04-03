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
import { EdgeType } from '@prisma/client';
import { signOut } from 'next-auth/react';
import { ActivityLogPanel } from '@/components/activity-log-panel';
import { EmployeeNode } from '@/components/canvas/employee-node';
import { EmployeeEditorPanel } from '@/components/employee-editor-panel';
import { TeamEditorPanel } from '@/components/team-editor-panel';
import { Button } from '@/components/ui/button';
import { layoutNodesAsGrid } from '@/lib/canvas-layout';
import { ArrowLeft, LayoutGrid, Logs, Maximize2, Plus, Search, ZoomIn } from 'lucide-react';

const nodeTypes = {
  employee: ({ id, data, selected }: { id: string; data: { name: string; onEdit?: () => void }; selected: boolean }) => (
    <EmployeeNode employeeId={id} name={data.name} selected={selected} onEdit={data.onEdit} />
  ),
};

type TeamCanvasProps = {
  initialNodes: Node[];
  initialEdges: Edge[];
  teamId: string;
  organizationId: string;
  teamName: string;
  teamInstructions: string;
  logs: Array<{ id: string; action: string; subjectType: string; createdAt: string | Date }>;
};

export function TeamCanvas({
  initialNodes,
  initialEdges,
  teamId,
  organizationId,
  teamName,
  teamInstructions,
  logs,
}: TeamCanvasProps) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [teamEditorOpen, setTeamEditorOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [adding, setAdding] = useState(false);
  const [autoLayouting, setAutoLayouting] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
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
            onEdit: () => setEditingEmployeeId(n.id),
          },
          selected: n.id === selectedNodeId,
        })),
    [nodes, search, selectedNodeId],
  );

  const onConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    setEdges((eds) => addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed }, data: { edgeType: EdgeType.HANDOFF } }, eds));
    await fetch('/api/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'employee', teamId, sourceId: connection.source, targetId: connection.target, edgeType: 'HANDOFF' }),
    });
  };

  const onNodeDragStop = async (_: unknown, node: Node) => {
    setNodes((nds) => nds.map((n) => (n.id === node.id ? node : n)));
    await fetch('/api/employees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: node.id, positionX: node.position.x, positionY: node.position.y }),
    });
  };

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  };

  const createEmployee = async () => {
    if (!newEmployeeName.trim()) return;
    setAdding(true);
    await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, teamId, name: newEmployeeName.trim() }),
    });
    setAdding(false);
    setNewEmployeeName('');
    window.location.reload();
  };

  const runAutoLayout = async () => {
    setAutoLayouting(true);
    const sorted = [...nodes].sort((a, b) => String((a.data as { name?: string }).name ?? '').localeCompare(String((b.data as { name?: string }).name ?? '')));
    const positioned = layoutNodesAsGrid(sorted);
    setNodes(positioned);
    await Promise.all(positioned.map((node) => fetch('/api/employees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: node.id, positionX: node.position.x, positionY: node.position.y }),
    })));
    flow?.fitView({ padding: 0.2, duration: 500 });
    setAutoLayouting(false);
  };

  const editingEmployee = editingEmployeeId ? nodes.find((n) => n.id === editingEmployeeId) : null;

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
        defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#14b8a6', strokeWidth: 1.6 } }}
      >
        <MiniMap pannable zoomable className="!bg-slate-950/85" nodeColor="#14b8a6" maskColor="rgba(2,6,23,0.6)" />
        <Controls className="!border-white/15 !bg-slate-900/85" />
        <Background color="rgba(148,163,184,0.22)" gap={22} />
      </ReactFlow>

      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="pointer-events-auto absolute left-4 top-4 w-[min(560px,calc(100vw-2rem))] rounded-2xl border border-white/12 bg-slate-950/88 p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-200/80">Team Canvas</div>
              <h2 className="text-base font-semibold text-white">{teamName}</h2>
              <div className="mt-1 text-xs text-slate-400">{nodes.length} employees · {edges.length} handoff edges</div>
            </div>
            <Link href={`/org/${organizationId}`}>
              <Button type="button" variant="secondary" size="sm" className="rounded-lg">
                <ArrowLeft size={14} />
                Organization
              </Button>
            </Link>
          </div>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="field pl-9" placeholder="Search employees" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="pointer-events-auto absolute right-4 top-4 flex max-w-[calc(100vw-2rem)] flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={() => setTeamEditorOpen(true)}>Edit Team</Button>
          <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={() => setShowAddPanel((v) => !v)}>
            <Plus size={14} />
            Add Employee
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
            <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Create Employee</div>
            <div className="flex gap-2">
              <input
                className="field"
                placeholder="Employee name"
                value={newEmployeeName}
                onChange={(e) => setNewEmployeeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void createEmployee();
                  }
                }}
              />
              <Button type="button" size="sm" className="rounded-lg" disabled={adding || !newEmployeeName.trim()} onClick={createEmployee}>
                {adding ? 'Adding' : 'Add'}
              </Button>
            </div>
          </div>
        ) : null}

        {showLogsPanel ? (
          <div className="pointer-events-auto absolute bottom-4 right-4 w-[min(540px,calc(100vw-2rem))]">
            <ActivityLogPanel logs={logs} className="h-[320px]" />
          </div>
        ) : null}
      </div>

      {editingEmployee ? (
        <EmployeeEditorPanel
          open
          employee={{
            id: editingEmployee.id,
            teamId,
            organizationId,
            name: String((editingEmployee.data as { name?: string }).name ?? ''),
            instructions: String((editingEmployee.data as { instructions?: string }).instructions ?? ''),
            modelPreference: String((editingEmployee.data as { modelPreference?: string }).modelPreference ?? 'GPT_4O_MINI') as 'GPT_4_1' | 'GPT_4O' | 'GPT_4O_MINI',
          }}
          onClose={() => setEditingEmployeeId(null)}
          onSaved={() => window.location.reload()}
        />
      ) : null}

      {teamEditorOpen ? (
        <TeamEditorPanel
          open
          team={{
            id: teamId,
            organizationId,
            name: teamName,
            instructions: teamInstructions,
          }}
          onClose={() => setTeamEditorOpen(false)}
          onSaved={() => window.location.reload()}
        />
      ) : null}
    </section>
  );
}
