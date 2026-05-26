'use client';

import '@xyflow/react/dist/style.css';

import { memo, useCallback, useEffect } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type FitViewOptions,
  Handle,
  type Node,
  type NodeProps,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';

function VizNode({ data }: NodeProps) {
  const label = typeof data?.label === 'string' ? data.label : '';
  const sub = typeof data?.sub === 'string' ? data.sub : '';
  return (
    <div
      className="min-w-[7.5rem] max-w-[10.5rem] rounded-lg border px-2 py-1.5 shadow-xs"
      style={{
        borderColor: 'rgb(var(--viz-node-border))',
        backgroundColor: 'rgb(var(--viz-node-bg))',
      }}
    >
      <Handle type="target" position={Position.Left} id="in-l" className="!h-2 !w-2 !border-0 !bg-slate-400 dark:!bg-stone-500" />
      <Handle type="target" position={Position.Top} id="in-t" className="!h-2 !w-2 !border-0 !bg-slate-400 dark:!bg-stone-500" />
      <div className="text-[10px] font-semibold leading-tight text-app-text">{label}</div>
      {sub ? <div className="mt-0.5 text-[9px] leading-snug text-app-muted">{sub}</div> : null}
      <Handle type="source" position={Position.Right} id="out-r" className="!h-2 !w-2 !border-0 !bg-slate-400 dark:!bg-stone-500" />
      <Handle type="source" position={Position.Bottom} id="out-b" className="!h-2 !w-2 !border-0 !bg-slate-400 dark:!bg-stone-500" />
    </div>
  );
}

const nodeTypes = { viz: memo(VizNode) };

function rgbEdgeStroke(): string {
  if (typeof window === 'undefined') return 'rgb(148, 163, 184)';
  const t = getComputedStyle(document.documentElement).getPropertyValue('--viz-edge').trim();
  const p = t.split(/\s+/).filter(Boolean);
  return p.length >= 3 ? `rgb(${p.slice(0, 3).join(',')})` : 'rgb(148, 163, 184)';
}

function FlowInner({
  id,
  title,
  subtitle,
  height,
  nodes: initialNodes,
  edges: initialEdges,
  fitViewOptions,
}: {
  id: string;
  title: string;
  subtitle?: string;
  height: number;
  nodes: Node[];
  edges: Edge[];
  fitViewOptions?: FitViewOptions;
}) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const { fitView } = useReactFlow();

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      fitView({ padding: 0.12, duration: 280, ...fitViewOptions });
    });
    return () => cancelAnimationFrame(raf);
  }, [fitView, fitViewOptions]);

  const minimapNodeColor = useCallback(() => {
    const t = getComputedStyle(document.documentElement).getPropertyValue('--viz-edge-active').trim();
    const p = t.split(/\s+/).filter(Boolean);
    return p.length >= 3 ? `rgb(${p.slice(0, 3).join(',')})` : '#6366f1';
  }, []);

  const stroke = rgbEdgeStroke();

  return (
    <figure className="min-w-0" aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="mb-1.5 px-0.5">
        <div className="text-[11px] font-semibold text-app-text">{title}</div>
        {subtitle ? <p className="mt-0.5 text-[10px] text-app-muted">{subtitle}</p> : null}
      </figcaption>
      <div
        className="overflow-hidden rounded-lg border border-app-border bg-app-fill/50 dark:bg-app-fill/30"
        style={{ height }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          minZoom={0.4}
          maxZoom={1.4}
          defaultEdgeOptions={{
            style: { strokeWidth: 1.5, stroke },
            type: 'smoothstep',
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="rgb(var(--app-border))" />
          <Controls showInteractive={false} className="!shadow-xs" />
          <MiniMap
            pannable
            zoomable
            nodeStrokeWidth={2}
            nodeColor={minimapNodeColor}
            maskColor="rgb(var(--viz-minimap-mask) / 0.65)"
            className="!rounded-md !border !border-app-border"
            style={{ height: 56, width: 88 }}
          />
        </ReactFlow>
      </div>
    </figure>
  );
}

export type ArchitectureFlowProps = {
  /** Unique id for figure / caption wiring */
  flowId: string;
  title: string;
  subtitle?: string;
  height: number;
  nodes: Node[];
  edges: Edge[];
  fitViewOptions?: FitViewOptions;
};

export function ArchitectureFlow(props: ArchitectureFlowProps) {
  const { flowId, ...rest } = props;
  return (
    <ReactFlowProvider>
      <FlowInner {...rest} id={flowId} />
    </ReactFlowProvider>
  );
}
