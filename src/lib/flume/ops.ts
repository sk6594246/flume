import { crossSpan, nearestLane, nodeBox, snap, worldToLocal } from "./geometry";
import { tidy } from "./layout";
import type { Diagram, EdgeKind, FlowNode, NodeKind, Orientation } from "./types";
import { KIND_DEFAULT, uniqueId } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function setTitle(diagram: Diagram, title: string): Diagram {
  return { ...diagram, title };
}

export function setOrientation(diagram: Diagram, orientation: Orientation): Diagram {
  if (diagram.orientation === orientation) return diagram;
  return {
    ...diagram,
    orientation,
    nodes: diagram.nodes.map((node) =>
      node.kind === "parallel" ? { ...node, w: node.h, h: node.w } : node,
    ),
  };
}

export function addLane(diagram: Diagram): Diagram {
  const used = new Set(diagram.lanes.map((lane) => lane.id));
  const id = uniqueId("lane", used);
  return {
    ...diagram,
    lanes: [...diagram.lanes, { id, name: "New lane", size: 164 }],
  };
}

export function updateLane(
  diagram: Diagram,
  laneId: string,
  patch: Partial<{ name: string; size: number; group: string }>,
): Diagram {
  return {
    ...diagram,
    lanes: diagram.lanes.map((lane) => {
      if (lane.id !== laneId) return lane;
      const next = { ...lane };
      if (patch.name !== undefined) next.name = patch.name;
      if (patch.size !== undefined) next.size = clamp(Math.round(patch.size), 120, 420);
      if (patch.group !== undefined) {
        const group = patch.group.trim();
        if (group) next.group = group;
        else delete next.group;
      }
      return next;
    }),
  };
}

export function moveLane(diagram: Diagram, laneId: string, delta: number): Diagram {
  const index = diagram.lanes.findIndex((lane) => lane.id === laneId);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= diagram.lanes.length) return diagram;
  const lanes = diagram.lanes.slice();
  const [lane] = lanes.splice(index, 1);
  lanes.splice(next, 0, lane);
  return { ...diagram, lanes };
}

export function deleteLane(diagram: Diagram, laneId: string): Diagram {
  if (diagram.lanes.length <= 1) return diagram;
  const index = diagram.lanes.findIndex((lane) => lane.id === laneId);
  if (index < 0) return diagram;
  const fallback = diagram.lanes[index === 0 ? 1 : index - 1];
  const lanes = diagram.lanes.filter((lane) => lane.id !== laneId);
  return {
    ...diagram,
    lanes,
    nodes: diagram.nodes.map((node) => (node.laneId === laneId ? { ...node, laneId: fallback.id } : node)),
  };
}

export function addNode(
  diagram: Diagram,
  kind: NodeKind,
  worldX: number,
  worldY: number,
): { diagram: Diagram; id: string } {
  const defaults = KIND_DEFAULT[kind];
  let w = defaults.w;
  let h = defaults.h;
  if (kind === "parallel" && diagram.orientation === "columns") {
    w = defaults.h;
    h = defaults.w;
  }
  const lane = nearestLane(diagram, worldX + w / 2, worldY + h / 2);
  const local = worldToLocal(diagram, lane, worldX, worldY);
  const span = diagram.orientation === "rows" ? h : w;
  const across = clamp(snap(local.across), 8, Math.max(8, lane.size - span - 8));
  const along = Math.max(8, snap(local.along));
  const used = new Set(diagram.nodes.map((node) => node.id));
  const prefix = kind === "decision" ? "check" : kind === "parallel" ? "fork" : kind === "process" ? "step" : kind;
  const id = uniqueId(prefix, used);
  const node: FlowNode = {
    id,
    laneId: lane.id,
    kind,
    label: defaults.label,
    along,
    across,
    w,
    h,
  };
  return { diagram: { ...diagram, nodes: [...diagram.nodes, node] }, id };
}

export type DragOrigin = { id: string; x: number; y: number };

export function moveNodes(diagram: Diagram, origins: DragOrigin[], dx: number, dy: number): Diagram {
  const byId = new Map(origins.map((origin) => [origin.id, origin]));
  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => {
      const origin = byId.get(node.id);
      if (!origin) return node;
      return placeNode(diagram, node, origin.x + dx, origin.y + dy);
    }),
  };
}

function placeNode(diagram: Diagram, node: FlowNode, worldX: number, worldY: number): FlowNode {
  const lane = nearestLane(diagram, worldX + node.w / 2, worldY + node.h / 2);
  const local = worldToLocal(diagram, lane, worldX, worldY);
  const span = crossSpan(diagram.orientation, node);
  const across = clamp(snap(local.across), 8, Math.max(8, lane.size - span - 8));
  return {
    ...node,
    laneId: lane.id,
    along: Math.max(8, snap(local.along)),
    across,
  };
}

export function nudge(diagram: Diagram, ids: string[], dx: number, dy: number): Diagram {
  const origins = diagram.nodes
    .filter((node) => ids.includes(node.id))
    .map((node) => {
      const box = nodeBox(diagram, node);
      return { id: node.id, x: box.x, y: box.y };
    });
  return moveNodes(diagram, origins, dx, dy);
}

export function updateNode(
  diagram: Diagram,
  nodeId: string,
  patch: Partial<Pick<FlowNode, "label" | "kind" | "laneId">>,
): Diagram {
  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const next = { ...node, ...patch };
      if (patch.kind && patch.kind !== node.kind) {
        const defaults = KIND_DEFAULT[patch.kind];
        next.w = patch.kind === "parallel" && diagram.orientation === "columns" ? defaults.h : defaults.w;
        next.h = patch.kind === "parallel" && diagram.orientation === "columns" ? defaults.w : defaults.h;
        if (!patch.label) next.label = node.label === KIND_DEFAULT[node.kind].label ? defaults.label : node.label;
      }
      if (patch.laneId && !diagram.lanes.some((lane) => lane.id === patch.laneId)) return node;
      return next;
    }),
  };
}

export function addEdge(diagram: Diagram, from: string, to: string, kind: EdgeKind, label = ""): Diagram {
  if (!diagram.nodes.some((node) => node.id === from) || !diagram.nodes.some((node) => node.id === to)) {
    return diagram;
  }
  if (diagram.edges.some((edge) => edge.from === from && edge.to === to && edge.kind === kind && edge.label === label)) {
    return diagram;
  }
  const used = new Set(diagram.edges.map((edge) => edge.id));
  return {
    ...diagram,
    edges: [...diagram.edges, { id: uniqueId("e", used), from, to, kind, label }],
  };
}

export function updateEdge(
  diagram: Diagram,
  edgeId: string,
  patch: Partial<Pick<FlowEdgePatch, "kind" | "label">>,
): Diagram {
  return {
    ...diagram,
    edges: diagram.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge)),
  };
}

type FlowEdgePatch = { kind: EdgeKind; label: string };

export function removeSelection(
  diagram: Diagram,
  selection: { kind: "node" | "edge" | "lane"; ids: string[] } | null,
): Diagram {
  if (!selection || !selection.ids.length) return diagram;
  if (selection.kind === "edge") {
    const drop = new Set(selection.ids);
    return { ...diagram, edges: diagram.edges.filter((edge) => !drop.has(edge.id)) };
  }
  if (selection.kind === "lane") {
    return selection.ids.reduce((next, id) => deleteLane(next, id), diagram);
  }
  const drop = new Set(selection.ids);
  return {
    ...diagram,
    nodes: diagram.nodes.filter((node) => !drop.has(node.id)),
    edges: diagram.edges.filter((edge) => !drop.has(edge.from) && !drop.has(edge.to)),
  };
}

export function duplicateNodes(diagram: Diagram, ids: string[]): { diagram: Diagram; ids: string[] } {
  const picked = diagram.nodes.filter((node) => ids.includes(node.id));
  if (!picked.length) return { diagram, ids: [] };
  const used = new Set(diagram.nodes.map((node) => node.id));
  const map = new Map<string, string>();
  const clones = picked.map((node) => {
    const id = uniqueId(node.id.replace(/\d+$/, "") || node.kind, used);
    used.add(id);
    map.set(node.id, id);
    return { ...node, id, along: node.along + 28, across: node.across + 20 };
  });
  const usedEdges = new Set(diagram.edges.map((item) => item.id));
  const edges = diagram.edges
    .filter((edge) => map.has(edge.from) && map.has(edge.to))
    .map((edge) => {
      const id = uniqueId("e", usedEdges);
      usedEdges.add(id);
      return { ...edge, id, from: map.get(edge.from) ?? edge.from, to: map.get(edge.to) ?? edge.to };
    });
  return {
    diagram: { ...diagram, nodes: [...diagram.nodes, ...clones], edges: [...diagram.edges, ...edges] },
    ids: clones.map((node) => node.id),
  };
}

export function placeLane(diagram: Diagram, laneId: string, targetIndex: number): Diagram {
  const from = diagram.lanes.findIndex((lane) => lane.id === laneId);
  if (from < 0 || from === targetIndex) return diagram;
  const lanes = diagram.lanes.slice();
  const [lane] = lanes.splice(from, 1);
  lanes.splice(clamp(targetIndex, 0, lanes.length), 0, lane);
  if (lanes.every((item, i) => item.id === diagram.lanes[i]?.id)) return diagram;
  return { ...diagram, lanes };
}

export function applyTidy(diagram: Diagram): Diagram {
  return tidy(diagram);
}

export function sameDiagram(a: Diagram, b: Diagram): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
