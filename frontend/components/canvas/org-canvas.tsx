'use client';

import { useMemo, useState } from 'react';
import ReactFlow, { addEdge, Background, Connection, Controls, Edge, MarkerType, MiniMap, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { EdgeType } from '@prisma/client';
import { TeamNode } from '@/components/canvas/team-node';
import { TeamEditorPanel } from '@/components/team-editor-panel';
import { Button } from '@/components/ui/button';

const nodeTypes = {
  team: ({ id, data, selected }: { id: string; data: { name: string; onEdit?: () => void }; selected: boolean }) => (
    <TeamNode teamId={id} name={data.name} selected={selected} onEdit={data.onEdit} />
  ),
};

export function OrgCanvas({ initialNodes, initialEdges, organizationId }: { initialNodes: Node[]; initialEdges: Edge[]; organizationId: string }) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
    await fetch('/api/edges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'team', organizationId, sourceId: connection.source, targetId: connection.target, edgeType: 'HIERARCHY' }) });
  };

  const onNodeDragStop = async (_: unknown, node: Node) => {
    setNodes((nds) => nds.map((n) => (n.id === node.id ? node : n)));
    await fetch('/api/teams', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId: node.id, positionX: node.position.x, positionY: node.position.y }) });
  };

  const editingTeam = editingTeamId
    ? nodes.find((n) => n.id === editingTeamId)
    : null;

  return (
    <>
      <div className="relative h-[70vh] overflow-hidden rounded border">
        <div className="absolute left-2 top-2 z-10 flex gap-2">
          <input className="rounded border bg-white px-2 py-1 text-xs" placeholder="Search teams" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="button" onClick={async () => {
            const name = window.prompt('Team name');
            if (!name) return;
            await fetch('/api/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, name }) });
            window.location.reload();
          }}>+ Team</Button>
        </div>
        <ReactFlow
          nodes={visibleNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={() => {}}
          onEdgesChange={() => {}}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onNodeDragStop={onNodeDragStop}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
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
    </>
  );
}
