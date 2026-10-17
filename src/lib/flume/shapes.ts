import type { NodeKind } from "./types";

export type PaintMode = "css" | "hex";

export type DrawOp =
  | { op: "path"; d: string; fill: string; stroke: string; sw: number }
  | { op: "rect"; x: number; y: number; w: number; h: number; rx: number; fill: string; stroke: string; sw: number }
  | { op: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number }
  | { op: "circle"; cx: number; cy: number; r: number; fill: string };

const HEX = {
  line: "#2a241c",
  chip: "#fffdf8",
  ink: "#1c1914",
  paper: "#f3eee4",
  copper: "#c4622d",
  note: "#f8efe4",
};

function token(mode: PaintMode, name: keyof typeof HEX, css: string): string {
  return mode === "hex" ? HEX[name] : css;
}

export function shapeOps(kind: NodeKind, w: number, h: number, selected: boolean, mode: PaintMode): DrawOp[] {
  const stroke = selected ? token(mode, "copper", "var(--color-copper)") : token(mode, "line", "var(--color-line)");
  const sw = selected ? 2.25 : 1.6;
  const chip = token(mode, "chip", "var(--color-chip)");
  const ink = token(mode, "ink", "var(--color-ink)");
  const paper = token(mode, "paper", "var(--color-paper)");
  const copper = token(mode, "copper", "var(--color-copper)");
  const note = token(mode, "note", "color-mix(in srgb, var(--color-copper) 14%, var(--color-chip))");
  const fill = kind === "end" ? ink : kind === "note" ? note : chip;

  if (kind === "start" || kind === "end") {
    const ops: DrawOp[] = [
      { op: "rect", x: 1, y: 1, w: w - 2, h: h - 2, rx: (h - 2) / 2, fill, stroke, sw },
    ];
    if (kind === "start") ops.push({ op: "circle", cx: 18, cy: h / 2, r: 4, fill: copper });
    if (kind === "end") {
      ops.push({
        op: "rect",
        x: 6,
        y: 6,
        w: Math.max(8, w - 12),
        h: Math.max(8, h - 12),
        rx: Math.max(4, (h - 12) / 2),
        fill: "none",
        stroke: paper,
        sw: 1.25,
      });
    }
    return ops;
  }

  if (kind === "process") {
    return [{ op: "rect", x: 1, y: 1, w: w - 2, h: h - 2, rx: 10, fill, stroke, sw }];
  }

  if (kind === "subprocess") {
    return [
      { op: "rect", x: 1, y: 1, w: w - 2, h: h - 2, rx: 10, fill, stroke, sw },
      { op: "line", x1: 9, y1: 8, x2: 9, y2: h - 8, stroke, sw },
      { op: "line", x1: w - 9, y1: 8, x2: w - 9, y2: h - 8, stroke, sw },
    ];
  }

  if (kind === "decision") {
    return [
      {
        op: "path",
        d: `M ${w / 2} 1 L ${w - 1} ${h / 2} L ${w / 2} ${h - 1} L 1 ${h / 2} Z`,
        fill,
        stroke,
        sw,
      },
    ];
  }

  if (kind === "data") {
    const skew = Math.min(18, w * 0.12);
    return [
      {
        op: "path",
        d: `M ${skew} 1 H ${w - 1} L ${w - 1 - skew} ${h - 1} H 1 Z`,
        fill,
        stroke,
        sw,
      },
    ];
  }

  if (kind === "manual") {
    const inset = Math.min(22, w * 0.16);
    return [
      {
        op: "path",
        d: `M 1 ${inset} H ${w - 1} L ${w - 1 - inset * 0.15} ${h - 1} H ${inset} Z`,
        fill,
        stroke,
        sw,
      },
    ];
  }

  if (kind === "document") {
    const wave = Math.min(16, h * 0.22);
    return [
      {
        op: "path",
        d: `M 1 1 H ${w - 1} V ${h - wave} C ${w * 0.78} ${h + wave * 0.15}, ${w * 0.58} ${h - wave * 1.7}, ${w * 0.45} ${h - wave * 0.85} C ${w * 0.28} ${h - wave * 0.05}, ${w * 0.16} ${h - wave * 1.35}, 1 ${h - wave * 0.55} Z`,
        fill,
        stroke,
        sw,
      },
    ];
  }

  if (kind === "database") {
    const ry = Math.min(14, h * 0.18);
    return [
      {
        op: "path",
        d: `M 1 ${ry} C 1 ${ry * 0.2}, ${w - 1} ${ry * 0.2}, ${w - 1} ${ry} V ${h - ry} C ${w - 1} ${h - ry * 0.15}, 1 ${h - ry * 0.15}, 1 ${h - ry} Z`,
        fill,
        stroke,
        sw,
      },
      {
        op: "path",
        d: `M 1 ${ry} C 1 ${ry * 1.85}, ${w - 1} ${ry * 1.85}, ${w - 1} ${ry}`,
        fill: "none",
        stroke,
        sw,
      },
    ];
  }

  if (kind === "delay") {
    const r = Math.max(8, h / 2 - 1);
    return [
      {
        op: "path",
        d: `M 1 1 H ${w - r} A ${r} ${r} 0 0 1 ${w - r} ${h - 1} H 1 Z`,
        fill,
        stroke,
        sw,
      },
    ];
  }

  if (kind === "note") {
    const fold = Math.min(16, w * 0.16);
    return [
      {
        op: "path",
        d: `M 1 1 H ${w - fold} L ${w - 1} ${fold} V ${h - 1} H 1 Z`,
        fill,
        stroke,
        sw,
      },
      {
        op: "path",
        d: `M ${w - fold} 1 V ${fold} H ${w - 1}`,
        fill: "none",
        stroke,
        sw,
      },
    ];
  }

  const thick = Math.min(26, Math.min(w, h) - 8);
  const bar =
    h >= w
      ? { x: (w - thick) / 2, y: 8, w: thick, h: Math.max(12, h - 32) }
      : { x: 8, y: (h - thick) / 2, w: Math.max(12, w - 32), h: thick };
  const cx = bar.x + bar.w / 2;
  const cy = bar.y + bar.h / 2;
  return [
    { op: "rect", x: bar.x, y: bar.y, w: bar.w, h: bar.h, rx: 8, fill: ink, stroke, sw },
    { op: "line", x1: cx, y1: cy - 7, x2: cx, y2: cy + 7, stroke: paper, sw: 1.75 },
    { op: "line", x1: cx - 7, y1: cy, x2: cx + 7, y2: cy, stroke: paper, sw: 1.75 },
  ];
}

export function opsToSvg(ops: DrawOp[]): string {
  return ops
    .map((op) => {
      if (op.op === "path") {
        return `<path d="${op.d}" fill="${op.fill}" stroke="${op.stroke}" stroke-width="${op.sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      if (op.op === "rect") {
        return `<rect x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" rx="${op.rx}" fill="${op.fill}" stroke="${op.stroke}" stroke-width="${op.sw}"/>`;
      }
      if (op.op === "circle") {
        return `<circle cx="${op.cx}" cy="${op.cy}" r="${op.r}" fill="${op.fill}"/>`;
      }
      return `<line x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}" stroke="${op.stroke}" stroke-width="${op.sw}" stroke-linecap="round"/>`;
    })
    .join("");
}
