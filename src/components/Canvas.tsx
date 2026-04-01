"use client";

import { useEffect, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import useCanvasStore from "@/store/useCanvasStore";
import { MOCK_NODES, MOCK_EDGES } from "@/store/mockData";
import TerminalNode from "@/components/nodes/TerminalNode";

export default function Canvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setNodes,
    setEdges,
  } = useCanvasStore();

  const nodeTypes: NodeTypes = useMemo(
    () => ({ terminal: TerminalNode }),
    []
  );

  // Load mock data on mount
  useEffect(() => {
    if (nodes.length === 0) {
      setNodes(MOCK_NODES);
      setEdges(MOCK_EDGES);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  const defaultEdgeOptions = useMemo(
    () => ({
      style: { stroke: "#39FF14", strokeWidth: 1.5 },
      type: "smoothstep" as const,
    }),
    []
  );

  const onNodeDelete = useCallback(
    (deleted: { id: string }[]) => {
      const store = useCanvasStore.getState();
      const deletedIds = new Set(deleted.map((n) => n.id));
      store.setEdges(
        store.edges.filter(
          (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)
        )
      );
    },
    []
  );

  return (
    <div className="relative flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodeDelete}
        nodeTypes={nodeTypes}
        proOptions={proOptions}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-black"
        style={{ background: "#000000" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#39FF1420"
          style={{ background: "#000000" }}
        />
        <Controls
          showInteractive={false}
          className="!bg-black !border !border-green !shadow-none [&>button]:!bg-black [&>button]:!border-green [&>button]:!text-green [&>button]:!border [&>button]:hover:!bg-green/10 [&>button>svg]:!fill-green"
        />
        <MiniMap
          nodeColor={(n) => {
            const data = n.data as { chaosAffected?: boolean };
            return data?.chaosAffected ? "#FF5F1F" : "#39FF14";
          }}
          maskColor="#000000cc"
          style={{
            background: "#000000",
            border: "1px solid #39FF14",
            borderRadius: 0,
          }}
        />
      </ReactFlow>
    </div>
  );
}
