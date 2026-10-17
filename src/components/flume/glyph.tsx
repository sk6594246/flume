import type { DrawOp } from "@/lib/flume/shapes";
import { shapeOps } from "@/lib/flume/shapes";
import type { NodeKind } from "@/lib/flume/types";

function paint(op: DrawOp, key: number) {
  if (op.op === "path") {
    return (
      <path
        key={key}
        d={op.d}
        fill={op.fill}
        stroke={op.stroke}
        strokeWidth={op.sw}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    );
  }
  if (op.op === "rect") {
    return (
      <rect
        key={key}
        x={op.x}
        y={op.y}
        width={op.w}
        height={op.h}
        rx={op.rx}
        fill={op.fill}
        stroke={op.stroke}
        strokeWidth={op.sw}
      />
    );
  }
  if (op.op === "circle") return <circle key={key} cx={op.cx} cy={op.cy} r={op.r} fill={op.fill} />;
  return (
    <line
      key={key}
      x1={op.x1}
      y1={op.y1}
      x2={op.x2}
      y2={op.y2}
      stroke={op.stroke}
      strokeWidth={op.sw}
      strokeLinecap="round"
    />
  );
}

export function Glyph({
  kind,
  w,
  h,
  selected = false,
}: {
  kind: NodeKind;
  w: number;
  h: number;
  selected?: boolean;
}) {
  const ops = shapeOps(kind, w, h, selected, "css");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      {ops.map(paint)}
    </svg>
  );
}

export function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <rect x="1" y="3" width="20" height="3.2" rx="1" fill="currentColor" opacity="0.88" />
      <rect x="1" y="9.4" width="20" height="3.2" rx="1" fill="currentColor" />
      <rect x="1" y="15.8" width="20" height="3.2" rx="1" fill="currentColor" opacity="0.45" />
      <circle cx="14.5" cy="11" r="2.2" fill="var(--color-copper)" />
    </svg>
  );
}
