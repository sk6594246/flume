import type { Diagram, FlowNode, Lane, Orientation } from "./types";
import { headerSize } from "./types";

export type Box = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

export function laneOrigin(diagram: Diagram, index: number): number {
  let origin = 0;
  for (let i = 0; i < index; i++) origin += diagram.lanes[i]?.size ?? 0;
  return origin;
}

export function laneIndex(diagram: Diagram, laneId: string): number {
  return diagram.lanes.findIndex((lane) => lane.id === laneId);
}

export function groupRuns(diagram: Diagram): { from: number; to: number; label: string }[] {
  const runs: { from: number; to: number; label: string }[] = [];
  let i = 0;
  const lanes = diagram.lanes;
  while (i < lanes.length) {
    const label = lanes[i]?.group?.trim() ?? "";
    if (!label) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < lanes.length && (lanes[j]?.group?.trim() ?? "") === label) j += 1;
    if (j - i >= 2) runs.push({ from: i, to: j - 1, label });
    i = j;
  }
  return runs;
}

export function worldSize(diagram: Diagram): { w: number; h: number } {
  const cross = diagram.lanes.reduce((sum, lane) => sum + lane.size, 0) || 160;
  const header = headerSize(diagram.orientation);
  let alongEnd = 520;
  for (const node of diagram.nodes) {
    const span = diagram.orientation === "rows" ? node.w : node.h;
    alongEnd = Math.max(alongEnd, node.along + span + 72);
  }
  const bracket = groupRuns(diagram).length ? 48 : 20;
  if (diagram.orientation === "rows") return { w: header + alongEnd + bracket, h: cross };
  return { w: cross, h: header + alongEnd + bracket };
}

export function nodeBox(diagram: Diagram, node: FlowNode): Box {
  const index = laneIndex(diagram, node.laneId);
  const origin = index < 0 ? 0 : laneOrigin(diagram, index);
  const header = headerSize(diagram.orientation);
  if (diagram.orientation === "rows") {
    return { x: header + node.along, y: origin + node.across, w: node.w, h: node.h };
  }
  return { x: origin + node.across, y: header + node.along, w: node.w, h: node.h };
}

export function worldToLocal(
  diagram: Diagram,
  lane: Lane,
  x: number,
  y: number,
): { along: number; across: number } {
  const index = laneIndex(diagram, lane.id);
  const origin = index < 0 ? 0 : laneOrigin(diagram, index);
  const header = headerSize(diagram.orientation);
  if (diagram.orientation === "rows") return { along: x - header, across: y - origin };
  return { along: y - header, across: x - origin };
}

export function nearestLane(diagram: Diagram, x: number, y: number): Lane {
  const cross = diagram.orientation === "rows" ? y : x;
  let origin = 0;
  let best = diagram.lanes[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const lane of diagram.lanes) {
    if (cross >= origin && cross < origin + lane.size) return lane;
    const dist = Math.abs(cross - (origin + lane.size / 2));
    if (dist < bestDist) {
      bestDist = dist;
      best = lane;
    }
    origin += lane.size;
  }
  return best;
}

export function snap(value: number, step = 8): number {
  return Math.round(value / step) * step;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type Side = "n" | "e" | "s" | "w";

function portPoint(box: Box, side: Side): Pt {
  if (side === "n") return { x: box.x + box.w / 2, y: box.y };
  if (side === "s") return { x: box.x + box.w / 2, y: box.y + box.h };
  if (side === "w") return { x: box.x, y: box.y + box.h / 2 };
  return { x: box.x + box.w, y: box.y + box.h / 2 };
}

function chooseSides(a: Box, b: Box): [Side, Side] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) >= Math.abs(dy) * 0.7) return dx >= 0 ? ["e", "w"] : ["w", "e"];
  return dy >= 0 ? ["s", "n"] : ["n", "s"];
}

function stub(point: Pt, side: Side, gap: number): Pt {
  if (side === "e") return { x: point.x + gap, y: point.y };
  if (side === "w") return { x: point.x - gap, y: point.y };
  if (side === "s") return { x: point.x, y: point.y + gap };
  return { x: point.x, y: point.y - gap };
}

export function routeEdge(a: Box, b: Box, self: boolean): { points: Pt[]; label: Pt } {
  if (self) {
    const x = a.x + a.w;
    const y = a.y + Math.min(a.h * 0.45, 28);
    const points = [
      { x, y },
      { x: x + 36, y: y - 28 },
      { x: x + 36, y: y + 36 },
      { x, y: y + 22 },
    ];
    return { points, label: { x: x + 44, y: y + 4 } };
  }
  const [s1, s2] = chooseSides(a, b);
  const p1 = portPoint(a, s1);
  const p2 = portPoint(b, s2);
  const gap = 18;
  const a2 = stub(p1, s1, gap);
  const b2 = stub(p2, s2, gap);
  let points: Pt[];
  const horizontal = s1 === "e" || s1 === "w";
  const otherHorizontal = s2 === "e" || s2 === "w";
  if (horizontal && otherHorizontal) {
    const mid = (a2.x + b2.x) / 2;
    points = [p1, a2, { x: mid, y: a2.y }, { x: mid, y: b2.y }, b2, p2];
  } else if (!horizontal && !otherHorizontal) {
    const mid = (a2.y + b2.y) / 2;
    points = [p1, a2, { x: a2.x, y: mid }, { x: b2.x, y: mid }, b2, p2];
  } else if (horizontal) {
    points = [p1, a2, { x: a2.x, y: b2.y }, b2, p2];
  } else {
    points = [p1, a2, { x: b2.x, y: a2.y }, b2, p2];
  }
  const midIndex = Math.floor(points.length / 2);
  const label = points[midIndex] ?? p2;
  return { points, label };
}

export function pointsToPath(points: Pt[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

export function selfPath(points: Pt[]): string {
  if (points.length < 4) return pointsToPath(points);
  const [a, c1, c2, b] = points;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export function slashAt(points: Pt[]): { x1: number; y1: number; x2: number; y2: number } | null {
  if (points.length < 2) return null;
  const p0 = points[0];
  const p1 = points[1];
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
  const t = Math.min(0.65, 16 / len);
  const x = p0.x + (p1.x - p0.x) * t;
  const y = p0.y + (p1.y - p0.y) * t;
  const nx = -(p1.y - p0.y) / len;
  const ny = (p1.x - p0.x) / len;
  return { x1: x - nx * 7, y1: y - ny * 7, x2: x + nx * 7, y2: y + ny * 7 };
}

export function crossSpan(orientation: Orientation, node: FlowNode): number {
  return orientation === "rows" ? node.h : node.w;
}

export function flowSpan(orientation: Orientation, node: FlowNode): number {
  return orientation === "rows" ? node.w : node.h;
}
