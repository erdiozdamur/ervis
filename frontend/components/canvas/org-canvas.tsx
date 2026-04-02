'use client';

import { useMemo, useState } from 'react';
import ReactFlow, { addEdge, Connection, Node, Edge, Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { TeamNode } from '@/components/canvas/team-node';
import { PropertiesPanel } from '@/components/properties-panel';

const nodeTypes = {
  team: ({ data }: { data: { name: string } }) => <TeamNode name={data.name} />,
};

export function OrgCanvas({ initialNodes, initialEdges, organizationId }: { initialNodes: Node[]; initialEdges: Edge[]; organizationId: string }) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selected, setSelected] = useState<Record<string, unknown> | undefined>();

  const onConnect = async (connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
    if (!connection.source || !connection.target) return;
    await fetch('/api/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'team', organizationId, sourceId: connection.source, targetId: connection.target }),
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

  const pane = useMemo(
    () => (
      <div className="flex h-[70vh] overflow-hidden rounded border">
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={() => {}}
            onEdgesChange={() => {}}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelected(node.data as Record<string, unknown>)}
            onNodeDragStop={onNodeDragStop}
            fitView
          >
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>
        </div>
        <PropertiesPanel data={selected} />
      </div>
    ),
    [edges, nodes, selected],
  );

  return pane;
}
