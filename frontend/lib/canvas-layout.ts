import { Node } from 'reactflow';

const CELL_WIDTH = 260;
const CELL_HEIGHT = 180;
const START_X = 100;
const START_Y = 100;

export function layoutNodesAsGrid(nodes: Node[]) {
  if (!nodes.length) return nodes;
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));

  return nodes.map((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      ...node,
      position: {
        x: START_X + (col * CELL_WIDTH),
        y: START_Y + (row * CELL_HEIGHT),
      },
    };
  });
}
