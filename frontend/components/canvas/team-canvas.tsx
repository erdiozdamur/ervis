'use client';

import { useState } from 'react';
import ReactFlow, { addEdge, Background, Connection, Controls, Edge, MiniMap, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { EmployeeNode } from '@/components/canvas/employee-node';
import { PropertiesPanel } from '@/components/properties-panel';

const nodeTypes = {
  employee: ({ data }: { data: { name: string; title?: string } }) => <EmployeeNode name={data.name} title={data.title} />,
};

export function TeamCanvas({ initialNodes, initialEdges, teamId }: { initialNodes: Node[]; initialEdges: Edge[]; teamId: string }) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selected, setSelected] = useState<Record<string, unknown> | undefined>();

  const onConnect = async (connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
    if (!connection.source || !connection.target) return;
    await fetch('/api/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'employee', teamId, sourceId: connection.source, targetId: connection.target }),
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

  return (
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
  );
}
