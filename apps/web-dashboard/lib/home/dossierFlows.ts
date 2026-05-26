import type { Edge, Node } from '@xyflow/react';

/** Interactive “how a run moves through the stack” — grounded in docker-compose wiring. */
export function requestPathNodesAndEdges(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: 'browser',
      type: 'viz',
      position: { x: 0, y: 48 },
      data: { label: 'Your browser', sub: 'Where you click & type' },
    },
    {
      id: 'dash',
      type: 'viz',
      position: { x: 200, y: 48 },
      data: { label: 'Web dashboard', sub: 'Next.js · port 3000' },
    },
    {
      id: 'api',
      type: 'viz',
      position: { x: 400, y: 48 },
      data: { label: 'Agent API', sub: 'FastAPI · 8080' },
    },
    {
      id: 'redis',
      type: 'viz',
      position: { x: 620, y: 8 },
      data: { label: 'Redis', sub: 'Job queues & cache' },
    },
    {
      id: 'worker',
      type: 'viz',
      position: { x: 620, y: 148 },
      data: { label: 'Agent worker', sub: 'Runs agent workflows' },
    },
    {
      id: 'router',
      type: 'viz',
      position: { x: 860, y: 48 },
      data: { label: 'Model router', sub: 'OpenAI-style · 8085' },
    },
    {
      id: 'ollama',
      type: 'viz',
      position: { x: 1080, y: 48 },
      data: { label: 'Ollama', sub: 'Local LLM runtime' },
    },
    {
      id: 'ingest',
      type: 'viz',
      position: { x: 400, y: 240 },
      data: { label: 'Ingestion worker', sub: 'Indexes uploads' },
    },
  ];

  const edges: Edge[] = [
    { id: 'e-b-d', source: 'browser', target: 'dash', sourceHandle: 'out-r', targetHandle: 'in-l' },
    { id: 'e-d-a', source: 'dash', target: 'api', sourceHandle: 'out-r', targetHandle: 'in-l' },
    { id: 'e-a-r', source: 'api', target: 'redis', sourceHandle: 'out-r', targetHandle: 'in-l' },
    { id: 'e-r-w', source: 'redis', target: 'worker', sourceHandle: 'out-b', targetHandle: 'in-t' },
    { id: 'e-a-w', source: 'api', target: 'worker', sourceHandle: 'out-b', targetHandle: 'in-t' },
    { id: 'e-w-ro', source: 'worker', target: 'router', sourceHandle: 'out-r', targetHandle: 'in-l' },
    { id: 'e-ro-o', source: 'router', target: 'ollama', sourceHandle: 'out-r', targetHandle: 'in-l' },
    { id: 'e-a-i', source: 'api', target: 'ingest', sourceHandle: 'out-b', targetHandle: 'in-t' },
  ];

  return { nodes, edges };
}

/** Where durable data lives — same stores the API and workers use. */
export function storagePathNodesAndEdges(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: 'hub',
      type: 'viz',
      position: { x: 380, y: 0 },
      data: { label: 'Services', sub: 'API & workers read / write' },
    },
    {
      id: 'postgres',
      type: 'viz',
      position: { x: 120, y: 220 },
      data: { label: 'PostgreSQL', sub: 'pgvector · projects & runs' },
    },
    {
      id: 'redis',
      type: 'viz',
      position: { x: 400, y: 220 },
      data: { label: 'Redis', sub: 'Queues & hot state' },
    },
    {
      id: 'minio',
      type: 'viz',
      position: { x: 680, y: 220 },
      data: { label: 'MinIO', sub: 'Object storage (S3-style)' },
    },
  ];

  const edges: Edge[] = [
    { id: 's-h-p', source: 'hub', target: 'postgres', sourceHandle: 'out-b', targetHandle: 'in-t' },
    { id: 's-h-r', source: 'hub', target: 'redis', sourceHandle: 'out-b', targetHandle: 'in-t' },
    { id: 's-h-m', source: 'hub', target: 'minio', sourceHandle: 'out-b', targetHandle: 'in-t' },
  ];

  return { nodes, edges };
}
