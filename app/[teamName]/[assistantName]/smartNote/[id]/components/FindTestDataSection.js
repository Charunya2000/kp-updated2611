import React from 'react';
import ReactFlow, { MiniMap, Controls, Background } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const nodes = [
  { id: 'start', type: 'input', data: { label: 'Start' }, position: { x: 250, y: 0 } },
  { id: 'configNode', data: { label: 'Config Node' }, position: { x: 250, y: 100 } },
  { id: 'embeddingNode', data: { label: 'Embedding Node' }, position: { x: 250, y: 200 } },
  { id: 'aiSearchNode', data: { label: 'AI Search Node' }, position: { x: 250, y: 300 } },
  { id: 'completionNode', data: { label: 'Completion Node' }, position: { x: 250, y: 400 } },
  { id: 'end', type: 'output', data: { label: 'End' }, position: { x: 250, y: 500 } },
];

const edges = [
  { id: 'e1-2', source: 'start', target: 'configNode', animated: true },
  { id: 'e2-3', source: 'configNode', target: 'embeddingNode', animated: true },
  { id: 'e3-4', source: 'embeddingNode', target: 'aiSearchNode', animated: true },
  { id: 'e4-5', source: 'aiSearchNode', target: 'completionNode', animated: true },
  { id: 'e5-6', source: 'completionNode', target: 'end', animated: true },
];

const FindTestDataSection = () => {
  return (
    <div style={{ marginLeft: 0, height: 600 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        draggable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        snapToGrid={true}
        snapGrid={[15, 15]}
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
};

export default FindTestDataSection;