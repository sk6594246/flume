import type { Diagram, EdgeKind, FlowEdge, FlowNode, Lane, Orientation } from "./types";
import {
  ARROW_KIND,
  EDGE_ARROW,
  KIND_DEFAULT,
  isEdgeKind,
  isNodeKind,
} from "./types";

export type ParseResult =
  | { ok: true; diagram: Diagram }
  | { ok: false; errors: string[] };

type Tok = { value: string; quoted: boolean };

function tokenize(line: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === " " || ch === "\t") {
      i += 1;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let value = "";
      while (j < line.length) {
        if (line[j] === "\\" && j + 1 < line.length) {
          value += line[j + 1];
          j += 2;
          continue;
        }
        if (line[j] === '"') {
          j += 1;
          break;
        }
        value += line[j];
        j += 1;
      }
      out.push({ value, quoted: true });
      i = j;
      continue;
    }
    if ("-.=~?>".includes(ch)) {
      let j = i;
      while (j < line.length && "-.=~?>".includes(line[j] ?? "")) j += 1;
      out.push({ value: line.slice(i, j), quoted: false });
      i = j;
      continue;
    }
    let j = i;
    while (j < line.length && line[j] !== " " && line[j] !== "\t" && line[j] !== '"') j += 1;
    out.push({ value: line.slice(i, j), quoted: false });
    i = j;
  }
  return out;
}

export function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function isId(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function pad(value: string, width: number): string {
  return value.length >= width ? `${value} ` : value + " ".repeat(width - value.length);
}

export function serialize(diagram: Diagram): string {
  const lines: string[] = [
    "dialect flume/1",
    `flow ${quote(diagram.title)}`,
    `direction ${diagram.orientation}`,
    "",
  ];

  const laneWidth = Math.max(8, ...diagram.lanes.map((lane) => lane.id.length));
  for (const lane of diagram.lanes) {
    let line = `lane ${pad(lane.id, laneWidth)} ${quote(lane.name)}  size ${String(Math.round(lane.size)).padStart(3)}`;
    if (lane.group?.trim()) line += `  group ${quote(lane.group.trim())}`;
    lines.push(line);
  }

  lines.push("");
  const ordered = diagram.nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => {
      const laneA = diagram.lanes.findIndex((lane) => lane.id === a.node.laneId);
      const laneB = diagram.lanes.findIndex((lane) => lane.id === b.node.laneId);
      if (laneA !== laneB) return laneA - laneB;
      if (a.node.along !== b.node.along) return a.node.along - b.node.along;
      return a.index - b.index;
    })
    .map((item) => item.node);

  const kindW = Math.max(6, ...ordered.map((node) => node.kind.length), 1);
  const idW = Math.max(6, ...ordered.map((node) => node.id.length), 1);
  for (const node of ordered) {
    const at = `${Math.round(node.along)},${Math.round(node.across)}`;
    const size = `${Math.round(node.w)}x${Math.round(node.h)}`;
    lines.push(
      `node ${pad(node.kind, kindW)} ${pad(node.id, idW)} ${quote(node.label)}  lane ${node.laneId}  at ${at}  size ${size}`,
    );
  }

  if (diagram.edges.length) {
    lines.push("");
    const fromW = Math.max(4, ...diagram.edges.map((edge) => edge.from.length));
    const toW = Math.max(4, ...diagram.edges.map((edge) => edge.to.length));
    for (const edge of diagram.edges) {
      let line = `edge ${pad(edge.from, fromW)} ${pad(EDGE_ARROW[edge.kind], 4)} ${pad(edge.to, edge.label ? toW : 0).trimEnd()}`;
      if (edge.label) line = `edge ${pad(edge.from, fromW)} ${pad(EDGE_ARROW[edge.kind], 4)} ${pad(edge.to, toW)} ${quote(edge.label)}`;
      lines.push(line);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function fail(errors: string[], line: number, message: string) {
  errors.push(`Line ${line}: ${message}`);
}

export function parse(source: string, id = "map"): ParseResult {
  const errors: string[] = [];
  let title = "Untitled map";
  let orientation: Orientation = "rows";
  let seenFlow = false;
  let seenDirection = false;
  const lanes: Lane[] = [];
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const laneIds = new Set<string>();
  const nodeIds = new Set<string>();
  let edgeCounter = 1;

  const lines = source.replace(/\r\n/g, "\n").split("\n");
  lines.forEach((raw, index) => {
    const lineNo = index + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("//")) return;
    const toks = tokenize(trimmed);
    const head = toks[0]?.value;
    if (!head) return;

    if (head === "dialect") return;

    if (head === "flow") {
      if (seenFlow) fail(errors, lineNo, "Only one flow title is allowed.");
      seenFlow = true;
      const name = toks[1];
      if (!name?.quoted) fail(errors, lineNo, 'Expected a quoted title, as in flow "Name".');
      else title = name.value || "Untitled map";
      if (toks.length > 2) fail(errors, lineNo, "Unexpected tokens after the title.");
      return;
    }

    if (head === "direction") {
      if (seenDirection) fail(errors, lineNo, "Direction is already set.");
      seenDirection = true;
      const value = toks[1]?.value;
      if (value !== "rows" && value !== "columns") {
        fail(errors, lineNo, "Direction must be rows or columns.");
      } else orientation = value;
      return;
    }

    if (head === "lane") {
      const idTok = toks[1];
      const nameTok = toks[2];
      if (!idTok || idTok.quoted || !isId(idTok.value)) {
        fail(errors, lineNo, "Lane needs an id like guest or lane_a.");
        return;
      }
      if (!nameTok?.quoted) {
        fail(errors, lineNo, "Lane needs a quoted name.");
        return;
      }
      if (laneIds.has(idTok.value)) {
        fail(errors, lineNo, `Lane ${idTok.value} is already defined.`);
        return;
      }
      let size = 164;
      let group: string | undefined;
      let cursor = 3;
      while (cursor < toks.length) {
        const key = toks[cursor]?.value;
        const val = toks[cursor + 1];
        if (key === "size" && val && !val.quoted && /^\d+(?:\.\d+)?$/.test(val.value)) {
          size = Math.max(96, Math.round(Number(val.value)));
          cursor += 2;
          continue;
        }
        if (key === "group" && val?.quoted) {
          group = val.value;
          cursor += 2;
          continue;
        }
        fail(errors, lineNo, `Unexpected lane token "${toks[cursor]?.value ?? ""}".`);
        return;
      }
      laneIds.add(idTok.value);
      lanes.push({ id: idTok.value, name: nameTok.value, size, group: group?.trim() || undefined });
      return;
    }

    if (head === "node") {
      const kindTok = toks[1]?.value ?? "";
      const idTok = toks[2];
      const labelTok = toks[3];
      if (!isNodeKind(kindTok)) {
        fail(errors, lineNo, `Unknown step kind "${kindTok}".`);
        return;
      }
      if (!idTok || idTok.quoted || !isId(idTok.value)) {
        fail(errors, lineNo, "Step needs an id such as arrive or pay_card.");
        return;
      }
      if (!labelTok?.quoted) {
        fail(errors, lineNo, "Step needs a quoted label.");
        return;
      }
      if (nodeIds.has(idTok.value)) {
        fail(errors, lineNo, `Step ${idTok.value} is already defined.`);
        return;
      }
      const defaults = KIND_DEFAULT[kindTok];
      let laneId = "";
      let along: number | null = null;
      let across: number | null = null;
      let w = defaults.w;
      let h = defaults.h;
      let cursor = 4;
      while (cursor < toks.length) {
        const key = toks[cursor]?.value;
        const val = toks[cursor + 1];
        if (key === "lane" && val && !val.quoted && isId(val.value)) {
          laneId = val.value;
          cursor += 2;
          continue;
        }
        if (key === "at" && val && !val.quoted && /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(val.value)) {
          const [a, c] = val.value.split(",");
          along = Math.round(Number(a));
          across = Math.round(Number(c));
          cursor += 2;
          continue;
        }
        if (key === "size" && val && !val.quoted && /^\d+x\d+$/i.test(val.value)) {
          const [sw, sh] = val.value.toLowerCase().split("x");
          w = Math.max(28, Math.round(Number(sw)));
          h = Math.max(28, Math.round(Number(sh)));
          cursor += 2;
          continue;
        }
        fail(errors, lineNo, `Unexpected step token "${toks[cursor]?.value ?? ""}".`);
        return;
      }
      if (!laneId) {
        fail(errors, lineNo, "Step is missing lane <id>.");
        return;
      }
      nodeIds.add(idTok.value);
      nodes.push({
        id: idTok.value,
        laneId,
        kind: kindTok,
        label: labelTok.value,
        along: along ?? Number.NaN,
        across: across ?? Number.NaN,
        w,
        h,
      });
      return;
    }

    if (head === "edge") {
      const from = toks[1];
      const arrow = toks[2];
      const to = toks[3];
      if (!from || from.quoted || !isId(from.value) || !to || to.quoted || !isId(to.value)) {
        fail(errors, lineNo, "Edge must look like: edge from --> to \"optional label\".");
        return;
      }
      const mapped = arrow ? ARROW_KIND[arrow.value] : undefined;
      if (!mapped) {
        fail(errors, lineNo, `Unknown arrow "${arrow?.value ?? ""}". Use -->, -.->, ?->, ==>, ..>, or ~~>.`);
        return;
      }
      let kind: EdgeKind = mapped;
      let label = "";
      const extra = toks.slice(4);
      for (const tok of extra) {
        if (!tok.quoted && isEdgeKind(tok.value)) {
          kind = tok.value;
          continue;
        }
        if (tok.quoted && !label) {
          label = tok.value;
          continue;
        }
        fail(errors, lineNo, `Unexpected edge token "${tok.value}".`);
        return;
      }
      edges.push({
        id: `e${edgeCounter++}`,
        from: from.value,
        to: to.value,
        kind,
        label,
      });
      return;
    }

    fail(errors, lineNo, `Unknown statement "${head}".`);
  });

  if (!lanes.length) fail(errors, 1, "Add at least one lane.");

  for (const node of nodes) {
    if (!laneIds.has(node.laneId)) {
      fail(errors, 1, `Step ${node.id} sits on unknown lane ${node.laneId}.`);
    }
  }
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      fail(errors, 1, `Edge ${edge.from} → ${edge.to} names a missing step.`);
    }
  }

  if (errors.length) return { ok: false, errors };

  const diagram: Diagram = {
    id,
    title,
    orientation,
    lanes,
    nodes: nodes.map((node) => ({
      ...node,
      along: Number.isFinite(node.along) ? node.along : 0,
      across: Number.isFinite(node.across) ? node.across : 0,
    })),
    edges: edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)),
  };

  const missing = diagram.nodes.some((node) => node.along === 0 && node.across === 0 && !sourceHasAt(source, node.id));
  if (missing) {
    return { ok: true, diagram: placeMissing(diagram, source) };
  }
  return { ok: true, diagram };
}

function sourceHasAt(source: string, id: string): boolean {
  return new RegExp(`\\b${id}\\b[^\\n]*\\bat\\b`).test(source);
}

function placeMissing(diagram: Diagram, source: string): Diagram {
  const needs = new Set(
    diagram.nodes.filter((node) => !sourceHasAt(source, node.id)).map((node) => node.id),
  );
  if (!needs.size) return diagram;
  const laneCursor = new Map<string, number>();
  for (const lane of diagram.lanes) laneCursor.set(lane.id, 36);
  const nodes = diagram.nodes.map((node) => {
    if (!needs.has(node.id)) return node;
    const along = laneCursor.get(node.laneId) ?? 36;
    laneCursor.set(node.laneId, along + (diagram.orientation === "rows" ? node.w : node.h) + 56);
    const lane = diagram.lanes.find((item) => item.id === node.laneId);
    const span = diagram.orientation === "rows" ? node.h : node.w;
    const across = Math.max(12, Math.round(((lane?.size ?? 160) - span) / 2));
    return { ...node, along, across };
  });
  return { ...diagram, nodes };
}

export function nodeLine(source: string, id: string): number | null {
  const lines = source.split("\n");
  const index = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed.startsWith("node ") && new RegExp(`\\b${id}\\b`).test(trimmed);
  });
  return index >= 0 ? index : null;
}

export function edgeLine(source: string, edge: FlowEdge): number | null {
  const lines = source.split("\n");
  const arrow = EDGE_ARROW[edge.kind];
  const index = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed.startsWith("edge ") && trimmed.includes(edge.from) && trimmed.includes(arrow) && trimmed.includes(edge.to);
  });
  return index >= 0 ? index : null;
}
