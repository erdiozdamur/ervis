'use client';

import { useMemo, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { EdgeType } from '@prisma/client';
import { LayoutGrid, Maximize2, Plus, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { EmployeeNode } from '@/components/canvas/employee-node';
import { EmployeeEditorPanel } from '@/components/employee-editor-panel';
import { TeamEditorPanel } from '@/components/team-editor-panel';
import { Button } from '@/components/ui/button';
import { layoutNodesAsGrid } from '@/lib/canvas-layout';

const nodeTypes = {
  employee: ({ id, data, selected }: { id: string; data: { name: string; onEdit?: () => void }; selected: boolean }) => (
    <EmployeeNode employeeId={id} name={data.name} selected={selected} onEdit={data.onEdit} />
  ),
};

export function TeamCanvas({
  initialNodes,
  initialEdges,
  teamId,
  organizationId,
  teamName,
  teamInstructions,
}: {
  initialNodes: Node[];
  initialEdges: Edge[];
  teamId: string;
  organizationId: string;
  teamName: string;
  teamInstructions: string;
}) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [teamEditorOpen, setTeamEditorOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [adding, setAdding] = useState(false);
  const [autoLayouting, setAutoLayouting] = useState(false);
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
    <>
      <section className="app-surface overflow-hidden">
        <div className="border-b border-white/10 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  className="field pl-9"
                  placeholder="Search employees"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-1 gap-2">
                <input
                  className="field"
                  placeholder="Quick add employee"
                  value={newEmployeeName}
                  onChange={(e) => setNewEmployeeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void createEmployee();
                    }
                  }}
                />
                <Button type="button" size="sm" disabled={adding || !newEmployeeName.trim()} onClick={createEmployee}>
                  <Plus size={14} />
                  {adding ? 'Adding' : 'Add'}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setTeamEditorOpen(true)}>Edit Team</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => flow?.zoomIn({ duration: 200 })}><ZoomIn size={14} />Zoom In</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => flow?.zoomOut({ duration: 200 })}><ZoomOut size={14} />Zoom Out</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => flow?.fitView({ padding: 0.2, duration: 300 })}><Maximize2 size={14} />Fit</Button>
              <Button type="button" variant="secondary" size="sm" disabled={autoLayouting} onClick={runAutoLayout}><LayoutGrid size={14} />{autoLayouting ? 'Layout...' : 'Auto Layout'}</Button>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-400">{nodes.length} employees · drag to reposition · connect nodes for handoff mapping</div>
        </div>

        <div className="relative h-[72vh]">
          <ReactFlow
            nodes={visibleNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={() => {}}
            onEdgesChange={() => {}}
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
            <MiniMap
              pannable
              zoomable
              className="!bg-slate-950/85"
              nodeColor="#14b8a6"
              maskColor="rgba(2,6,23,0.6)"
            />
            <Controls className="!border-white/15 !bg-slate-900/85" />
            <Background color="rgba(148,163,184,0.22)" gap={22} />
          </ReactFlow>
        </div>
      </section>

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
    </>
  );
}
