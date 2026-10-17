import type { Diagram, FlowEdge, FlowNode, Lane, NodeKind } from "./types";
import { KIND_DEFAULT } from "./types";

function center(size: number, span: number): number {
  return Math.round((size - span) / 2);
}

function node(
  id: string,
  laneId: string,
  kind: NodeKind,
  label: string,
  along: number,
  laneSize: number,
  w?: number,
  h?: number,
): FlowNode {
  const defaults = KIND_DEFAULT[kind];
  const width = w ?? defaults.w;
  const height = h ?? defaults.h;
  return {
    id,
    laneId,
    kind,
    label,
    along,
    across: center(laneSize, height),
    w: width,
    h: height,
  };
}

function edge(id: string, from: string, to: string, kind: FlowEdge["kind"], label = ""): FlowEdge {
  return { id, from, to, kind, label };
}

const patient: Lane = { id: "patient", name: "Patient", size: 152 };
const triage: Lane = { id: "triage", name: "Triage", size: 172 };
const clinician: Lane = { id: "clinician", name: "Clinician", size: 172 };
const diagnostics: Lane = { id: "diagnostics", name: "Diagnostics", size: 156, group: "In parallel" };
const billing: Lane = { id: "billing", name: "Billing", size: 156, group: "In parallel" };

export function admissionMap(): Diagram {
  return {
    id: "admission",
    title: "Admission desk",
    orientation: "rows",
    lanes: [patient, triage, clinician, diagnostics, billing],
    nodes: [
      node("arrive", "patient", "start", "Arrives", 28, patient.size),
      node("consent", "patient", "process", "Sign consent", 220, patient.size),
      node("hear", "patient", "process", "Hear the plan", 1600, patient.size, 180),
      node("leave", "patient", "end", "Departs", 1860, patient.size),
      node("vitals", "triage", "process", "Take vitals", 220, triage.size),
      node("acuity", "triage", "decision", "Urgent?", 460, triage.size),
      node("exam", "clinician", "process", "Examine", 720, clinician.size),
      node("fork", "clinician", "parallel", "Fork", 960, clinician.size, 108, 112),
      node("plan", "clinician", "process", "Write the plan", 1340, clinician.size, 184),
      node("labs", "diagnostics", "process", "Run labs", 1100, diagnostics.size),
      node("cover", "billing", "process", "Check coverage", 1100, billing.size, 184),
      node("claim", "billing", "data", "File the claim", 1600, billing.size),
    ],
    edges: [
      edge("e1", "arrive", "consent", "sequence"),
      edge("e2", "consent", "vitals", "message", "Chart"),
      edge("e3", "vitals", "acuity", "sequence"),
      edge("e4", "acuity", "exam", "conditional", "Yes"),
      edge("e5", "acuity", "labs", "conditional", "No"),
      edge("e6", "exam", "fork", "sequence"),
      edge("e7", "fork", "labs", "sequence", "Add-on"),
      edge("e8", "fork", "cover", "sequence"),
      edge("e9", "labs", "plan", "sequence"),
      edge("e10", "cover", "plan", "sequence"),
      edge("e11", "plan", "hear", "message", "Explain"),
      edge("e12", "plan", "claim", "message", "Codes"),
      edge("e13", "hear", "leave", "sequence"),
    ],
  };
}

const customer: Lane = { id: "customer", name: "Customer", size: 220 };
const shop: Lane = { id: "shop", name: "Shop", size: 230 };
const warehouse: Lane = { id: "warehouse", name: "Warehouse", size: 230, group: "In parallel" };
const carrier: Lane = { id: "carrier", name: "Carrier", size: 220, group: "In parallel" };

function columnNode(
  id: string,
  lane: Lane,
  kind: NodeKind,
  label: string,
  along: number,
  w?: number,
  h?: number,
): FlowNode {
  const defaults = KIND_DEFAULT[kind];
  const width = w ?? defaults.w;
  const height = h ?? defaults.h;
  return {
    id,
    laneId: lane.id,
    kind,
    label,
    along,
    across: center(lane.size, width),
    w: width,
    h: height,
  };
}

export function parcelMap(): Diagram {
  return {
    id: "parcel",
    title: "Parcel handoff",
    orientation: "columns",
    lanes: [customer, shop, warehouse, carrier],
    nodes: [
      columnNode("order", customer, "start", "Place order", 16),
      columnNode("received", customer, "end", "Parcel received", 980),
      columnNode("cart", shop, "process", "Reserve cart", 110, 180),
      columnNode("paid", shop, "decision", "Paid?", 230, 160, 108),
      columnNode("refund", shop, "end", "Refunded", 400),
      columnNode("pick", warehouse, "manual", "Pick items", 400, 180),
      columnNode("pack", warehouse, "process", "Pack", 540, 180),
      columnNode("label", carrier, "document", "Print label", 400, 176, 78),
      columnNode("haul", carrier, "process", "Line haul", 680, 176),
      columnNode("deliver", carrier, "delay", "Out for delivery", 830, 176, 58),
    ],
    edges: [
      edge("e1", "order", "cart", "message", "Order"),
      edge("e2", "cart", "paid", "sequence"),
      edge("e3", "paid", "pick", "conditional", "Yes"),
      edge("e4", "paid", "refund", "conditional", "No"),
      edge("e5", "pick", "pack", "sequence"),
      edge("e6", "pick", "label", "async", "Notify"),
      edge("e7", "pack", "haul", "message", "Manifest"),
      edge("e8", "label", "haul", "sequence"),
      edge("e9", "haul", "deliver", "sequence"),
      edge("e10", "deliver", "received", "message", "Proof"),
    ],
  };
}

export function blankMap(id: string): Diagram {
  const lanes: Lane[] = [
    { id: "people", name: "People", size: 168 },
    { id: "system", name: "System", size: 168 },
    { id: "partners", name: "Partners", size: 168 },
  ];
  return {
    id,
    title: "Untitled map",
    orientation: "rows",
    lanes,
    nodes: [node("start", "people", "start", "Start", 36, 168)],
    edges: [],
  };
}

export function seedLibrary(): Diagram[] {
  return [admissionMap(), parcelMap()];
}

export function isDiagram(value: unknown): value is Diagram {
  if (!value || typeof value !== "object") return false;
  const diagram = value as Diagram;
  if (typeof diagram.id !== "string" || typeof diagram.title !== "string") return false;
  if (diagram.orientation !== "rows" && diagram.orientation !== "columns") return false;
  if (!Array.isArray(diagram.lanes) || diagram.lanes.length === 0) return false;
  if (!Array.isArray(diagram.nodes) || !Array.isArray(diagram.edges)) return false;
  return diagram.lanes.every(
    (lane) => lane && typeof lane.id === "string" && typeof lane.name === "string" && typeof lane.size === "number",
  );
}
