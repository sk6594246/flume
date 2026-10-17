import { groupRuns, nodeBox, routeEdge, selfPath, slashAt, worldSize, pointsToPath } from "./geometry";
import { opsToSvg, shapeOps } from "./shapes";
import type { Diagram, EdgeKind } from "./types";
import { headerSize } from "./types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(label: string, max = 18): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function dash(kind: EdgeKind): string {
  if (kind === "message") return ' stroke-dasharray="7 5"';
  if (kind === "association") return ' stroke-dasharray="1.5 4"';
  if (kind === "async") return ' stroke-dasharray="11 4 2 4"';
  return "";
}

export function diagramToSvg(diagram: Diagram): string {
  const world = worldSize(diagram);
  const header = headerSize(diagram.orientation);
  const parts: string[] = [];
  parts.push(
    `<rect width="${world.w}" height="${world.h}" fill="#f7f3ea"/>`,
    `<defs>
      <marker id="arrow" viewBox="0 0 10 8" markerWidth="9" markerHeight="7" refX="9" refY="4" orient="auto">
        <path d="M0 0 L10 4 L0 8 Z" fill="#2a241c"/>
      </marker>
      <marker id="arrow-open" viewBox="0 0 10 8" markerWidth="9" markerHeight="7" refX="9" refY="4" orient="auto">
        <path d="M1 1 L9 4 L1 7" fill="none" stroke="#2a241c" stroke-width="1.4"/>
      </marker>
    </defs>`,
  );

  let origin = 0;
  diagram.lanes.forEach((lane, index) => {
    const alt = index % 2 === 1;
    if (diagram.orientation === "rows") {
      parts.push(
        `<rect x="${header}" y="${origin}" width="${world.w - header}" height="${lane.size}" fill="${alt ? "#f6f1e7" : "#efe8da"}"/>`,
        `<rect x="0" y="${origin}" width="${header}" height="${lane.size}" fill="#1c1914"/>`,
        `<text x="16" y="${origin + lane.size / 2}" fill="#f3eee4" font-family="Outfit, sans-serif" font-size="15" dominant-baseline="middle">${escapeXml(lane.name)}</text>`,
      );
    } else {
      parts.push(
        `<rect x="${origin}" y="${header}" width="${lane.size}" height="${world.h - header}" fill="${alt ? "#f6f1e7" : "#efe8da"}"/>`,
        `<rect x="${origin}" y="0" width="${lane.size}" height="${header}" fill="#1c1914"/>`,
        `<text x="${origin + lane.size / 2}" y="${header / 2}" fill="#f3eee4" font-family="Outfit, sans-serif" font-size="14" text-anchor="middle" dominant-baseline="middle">${escapeXml(lane.name)}</text>`,
      );
    }
    origin += lane.size;
  });

  for (const run of groupRuns(diagram)) {
    let start = 0;
    for (let i = 0; i < run.from; i++) start += diagram.lanes[i].size;
    let span = 0;
    for (let i = run.from; i <= run.to; i++) span += diagram.lanes[i].size;
    if (diagram.orientation === "rows") {
      const x = world.w - 28;
      parts.push(
        `<path d="M ${x} ${start + 10} H ${x + 12} V ${start + span - 10} H ${x}" fill="none" stroke="#c4622d" stroke-width="1.5"/>`,
        `<text x="${x + 16}" y="${start + span / 2}" fill="#8d4318" font-family="Outfit, sans-serif" font-size="11" transform="rotate(-90 ${x + 16} ${start + span / 2})" text-anchor="middle">${escapeXml(run.label)}</text>`,
      );
    }
  }

  const boxes = new Map(diagram.nodes.map((node) => [node.id, nodeBox(diagram, node)]));
  for (const edge of diagram.edges) {
    const from = boxes.get(edge.from);
    const to = boxes.get(edge.to);
    if (!from || !to) continue;
    const self = edge.from === edge.to;
    const routed = routeEdge(from, to, self);
    const d = self ? selfPath(routed.points) : pointsToPath(routed.points);
    const marker =
      edge.kind === "association" ? "" : edge.kind === "async" || edge.kind === "message" ? ' marker-end="url(#arrow-open)"' : ' marker-end="url(#arrow)"';
    const width = edge.kind === "default" ? 2.6 : 1.7;
    parts.push(`<path d="${d}" fill="none" stroke="#2a241c" stroke-width="${width}"${dash(edge.kind)}${marker} stroke-linejoin="round"/>`);
    const slash = edge.kind === "default" ? slashAt(routed.points) : null;
    if (slash) {
      parts.push(`<line x1="${slash.x1}" y1="${slash.y1}" x2="${slash.x2}" y2="${slash.y2}" stroke="#2a241c" stroke-width="1.6"/>`);
    }
    const text = edge.label || (edge.kind === "conditional" ? "?" : "");
    if (text) {
      parts.push(
        `<text x="${routed.label.x}" y="${routed.label.y}" fill="#1c1914" font-family="IBM Plex Mono, monospace" font-size="11" text-anchor="middle">${escapeXml(text)}</text>`,
      );
    }
  }

  for (const node of diagram.nodes) {
    const box = boxes.get(node.id);
    if (!box) continue;
    const ops = opsToSvg(shapeOps(node.kind, box.w, box.h, false, "hex"));
    parts.push(`<g transform="translate(${box.x} ${box.y})">${ops}</g>`);
    const lines = wrap(node.label, node.kind === "decision" ? 12 : 16);
    const fill = node.kind === "end" ? "#f3eee4" : "#1c1914";
    const lineHeight = 15;
    const startY = box.y + box.h / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => {
      parts.push(
        `<text x="${box.x + box.w / 2}" y="${startY + index * lineHeight}" fill="${fill}" font-family="Outfit, sans-serif" font-size="13" text-anchor="middle" dominant-baseline="middle">${escapeXml(line)}</text>`,
      );
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${world.w}" height="${world.h}" viewBox="0 0 ${world.w} ${world.h}">
  <title>${escapeXml(diagram.title)}</title>
  ${parts.join("\n  ")}
</svg>
`;
}

export function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "map";
}
