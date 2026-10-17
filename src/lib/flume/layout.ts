import type { Diagram, FlowNode } from "./types";
import { crossSpan, flowSpan } from "./geometry";

const GAP_ALONG = 64;
const GAP_ACROSS = 16;
const START = 28;

function depths(diagram: Diagram): Map<string, number> {
  const incoming = new Map<string, string[]>();
  const ids = new Set(diagram.nodes.map((node) => node.id));
  for (const node of diagram.nodes) incoming.set(node.id, []);
  for (const edge of diagram.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) continue;
    incoming.get(edge.to)?.push(edge.from);
  }
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const walk = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let value = 0;
    for (const parent of incoming.get(id) ?? []) value = Math.max(value, walk(parent) + 1);
    visiting.delete(id);
    depth.set(id, value);
    return value;
  };
  for (const node of diagram.nodes) walk(node.id);
  return depth;
}

/** Pack nodes by longest-path depth, keeping each step inside its lane. */
export function tidy(diagram: Diagram): Diagram {
  if (!diagram.nodes.length || !diagram.lanes.length) return diagram;
  const depth = depths(diagram);
  const maxDepth = Math.max(0, ...depth.values());
  const byDepth = new Map<number, FlowNode[]>();
  for (const node of diagram.nodes) {
    const slot = depth.get(node.id) ?? 0;
    const group = byDepth.get(slot) ?? [];
    group.push(node);
    byDepth.set(slot, group);
  }

  const alongAt = new Map<number, number>();
  let cursor = START;
  for (let slot = 0; slot <= maxDepth; slot++) {
    alongAt.set(slot, cursor);
    const group = byDepth.get(slot) ?? [];
    const span = Math.max(80, ...group.map((node) => flowSpan(diagram.orientation, node)));
    cursor += span + GAP_ALONG;
  }

  const laneSize = new Map<string, number>();
  for (const lane of diagram.lanes) {
    let need = Math.max(lane.size, 136);
    const mine = diagram.nodes.filter((node) => node.laneId === lane.id);
    const slots = new Set(mine.map((node) => depth.get(node.id) ?? 0));
    for (const slot of slots) {
      const siblings = mine.filter((node) => (depth.get(node.id) ?? 0) === slot);
      const total =
        siblings.reduce((sum, node) => sum + crossSpan(diagram.orientation, node), 0) +
        GAP_ACROSS * Math.max(0, siblings.length - 1);
      need = Math.max(need, total + 28);
    }
    laneSize.set(lane.id, Math.round(need));
  }

  const nodes = diagram.nodes.map((node) => {
    const slot = depth.get(node.id) ?? 0;
    const laneId = diagram.lanes.some((lane) => lane.id === node.laneId)
      ? node.laneId
      : diagram.lanes[0].id;
    const siblings = diagram.nodes
      .filter((item) => item.laneId === laneId && (depth.get(item.id) ?? 0) === slot)
      .slice()
      .sort((a, b) => a.across - b.across || a.along - b.along || a.id.localeCompare(b.id));
    const index = Math.max(0, siblings.findIndex((item) => item.id === node.id));
    const total =
      siblings.reduce((sum, item) => sum + crossSpan(diagram.orientation, item), 0) +
      GAP_ACROSS * Math.max(0, siblings.length - 1);
    const size = laneSize.get(laneId) ?? 160;
    let across = Math.max(12, (size - total) / 2);
    for (let i = 0; i < index; i++) {
      across += crossSpan(diagram.orientation, siblings[i]) + GAP_ACROSS;
    }
    return {
      ...node,
      laneId,
      along: Math.round(alongAt.get(slot) ?? START),
      across: Math.round(across),
    };
  });

  return {
    ...diagram,
    lanes: diagram.lanes.map((lane) => ({ ...lane, size: laneSize.get(lane.id) ?? lane.size })),
    nodes,
  };
}
