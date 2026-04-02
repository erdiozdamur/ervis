'use client';

import { useMemo, useState } from 'react';
import ReactFlow, { addEdge, Background, Connection, Controls, Edge, MarkerType, MiniMap, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { EdgeType } from '@prisma/client';
import { TeamNode } from '@/components/canvas/team-node';
import { PropertiesPanel } from '@/components/properties-panel';
import { Button } from '@/components/ui/button';

const nodeTypes = {
  team: ({ data, selected }: { data: { name: string }; selected: boolean }) => <TeamNode name={data.name} selected={selected} />,
};

export function OrgCanvas({ initialNodes, initialEdges, organizationId }: { initialNodes: Node[]; initialEdges: Edge[]; organizationId: string }) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [search, setSearch] = useState('');

  const visibleNodes = useMemo(() => nodes.filter((n) => String((n.data as { name?: string }).name ?? '').toLowerCase().includes(search.toLowerCase())), [nodes, search]);

  const onConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    setEdges((eds) => addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed }, data: { edgeType: EdgeType.HIERARCHY } }, eds));
    await fetch('/api/edges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'team', organizationId, sourceId: connection.source, targetId: connection.target, edgeType: 'HIERARCHY' }) });
  };

  const onNodeDragStop = async (_: unknown, node: Node) => {
    setNodes((nds) => nds.map((n) => (n.id === node.id ? node : n)));
    await fetch('/api/teams', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId: node.id, positionX: node.position.x, positionY: node.position.y }) });
  };

  const selectedEntity = selectedNode
    ? ({ kind: 'team', id: selectedNode.id, organizationId, ...(selectedNode.data as object) } as never)
    : undefined;

  const selectedEdges = selectedNode ? edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).map((e) => ({ id: e.id, label: e.label as string | null, edgeType: ((e.data as { edgeType?: EdgeType } | undefined)?.edgeType ?? EdgeType.HIERARCHY), description: '', conditionNote: '' })) : [];

  return (
    <div className="flex h-[70vh] overflow-hidden rounded border">
      <div className="relative flex-1">
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
          onNodeClick={(_, node) => setSelectedNode(node)}
          onNodeDragStop={onNodeDragStop}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
      <PropertiesPanel entity={selectedEntity} edges={selectedEdges} refresh={() => window.location.reload()} />
    </div>
  );
}
