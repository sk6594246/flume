export type Orientation = "rows" | "columns";

export const NODE_KINDS = [
  "start",
  "end",
  "process",
  "decision",
  "data",
  "document",
  "subprocess",
  "database",
  "manual",
  "delay",
  "note",
  "parallel",
] as const;

export type NodeKind = (typeof NODE_KINDS)[number];

export const EDGE_KINDS = [
  "sequence",
  "message",
  "conditional",
  "default",
  "association",
  "async",
] as const;

export type EdgeKind = (typeof EDGE_KINDS)[number];

export type Lane = {
  id: string;
  name: string;
  /** Cross-axis size in px. Height for row lanes, width for column lanes. */
  size: number;
  /** Consecutive lanes that share a group draw as a parallel band. */
  group?: string;
};

export type FlowNode = {
  id: string;
  laneId: string;
  kind: NodeKind;
  label: string;
  /** Position along the flow. */
  along: number;
  /** Position inside the lane, across the flow. */
  across: number;
  w: number;
  h: number;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  label: string;
};

export type Diagram = {
  id: string;
  title: string;
  orientation: Orientation;
  lanes: Lane[];
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export const HEADER_ROW = 148;
export const HEADER_COL = 68;

export const KIND_LABEL: Record<NodeKind, string> = {
  start: "Start",
  end: "End",
  process: "Process",
  decision: "Decision",
  data: "Data",
  document: "Document",
  subprocess: "Subprocess",
  database: "Database",
  manual: "Manual",
  delay: "Delay",
  note: "Note",
  parallel: "Parallel",
};

export const KIND_BLURB: Record<NodeKind, string> = {
  start: "Where a flow begins",
  end: "Terminator",
  process: "A step someone does",
  decision: "Yes / no branch",
  data: "Input or output",
  document: "A record or file",
  subprocess: "A nested flow",
  database: "Stored record",
  manual: "Done by hand",
  delay: "Wait",
  note: "Annotation",
  parallel: "Fork or join",
};

export const KIND_DEFAULT: Record<NodeKind, { w: number; h: number; label: string }> = {
  start: { w: 148, h: 54, label: "Start" },
  end: { w: 148, h: 54, label: "End" },
  process: { w: 176, h: 64, label: "Process" },
  decision: { w: 156, h: 112, label: "Decision?" },
  data: { w: 176, h: 60, label: "Data" },
  document: { w: 164, h: 78, label: "Document" },
  subprocess: { w: 184, h: 68, label: "Subprocess" },
  database: { w: 132, h: 86, label: "Database" },
  manual: { w: 176, h: 64, label: "Manual step" },
  delay: { w: 150, h: 58, label: "Delay" },
  note: { w: 168, h: 92, label: "Note" },
  parallel: { w: 108, h: 112, label: "Fork" },
};

export const EDGE_LABEL: Record<EdgeKind, string> = {
  sequence: "Sequence",
  message: "Message",
  conditional: "Conditional",
  default: "Default",
  association: "Association",
  async: "Async",
};

export const EDGE_BLURB: Record<EdgeKind, string> = {
  sequence: "Solid control flow",
  message: "Dashed handoff",
  conditional: "Labeled branch",
  default: "Heavy fallback path",
  association: "Dotted, no arrow",
  async: "Signal, not a wait",
};

export const EDGE_ARROW: Record<EdgeKind, string> = {
  sequence: "-->",
  message: "-.->",
  conditional: "?->",
  default: "==>",
  association: "..>",
  async: "~~>",
};

export const ARROW_KIND: Record<string, EdgeKind> = {
  "-->": "sequence",
  "-.->": "message",
  "?->": "conditional",
  "==>": "default",
  "..>": "association",
  "~~>": "async",
};

const KIND_SET = new Set<string>(NODE_KINDS);
const EDGE_SET = new Set<string>(EDGE_KINDS);

export function isNodeKind(value: string): value is NodeKind {
  return KIND_SET.has(value);
}

export function isEdgeKind(value: string): value is EdgeKind {
  return EDGE_SET.has(value);
}

export function headerSize(orientation: Orientation): number {
  return orientation === "rows" ? HEADER_ROW : HEADER_COL;
}

export function uniqueId(prefix: string, used: Set<string>): string {
  let i = 1;
  let id = `${prefix}${i}`;
  while (used.has(id)) id = `${prefix}${++i}`;
  return id;
}
