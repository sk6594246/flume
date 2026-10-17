import type { PointerEvent } from "react";
import { Glyph } from "@/components/flume/glyph";
import type { EdgeKind, NodeKind } from "@/lib/flume/types";
import { EDGE_BLURB, EDGE_KINDS, EDGE_LABEL, KIND_BLURB, KIND_LABEL } from "@/lib/flume/types";

const FLOW: NodeKind[] = ["start", "end", "process", "subprocess", "manual", "delay"];
const BRANCH: NodeKind[] = ["decision", "parallel"];
const RECORDS: NodeKind[] = ["data", "document", "database", "note"];

function Group({
  title,
  kinds,
  armed,
  onPointerDown,
}: {
  title: string;
  kinds: NodeKind[];
  armed: NodeKind | null;
  onPointerDown: (kind: NodeKind, event: PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div>
      <div className="section-label">
        <span className="kicker">{title}</span>
      </div>
      <div className="stack">
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className={armed === kind ? "palette-item is-on" : "palette-item"}
            aria-pressed={armed === kind}
            onPointerDown={(event) => onPointerDown(kind, event)}
          >
            <Glyph kind={kind} w={42} h={30} />
            <span>
              {KIND_LABEL[kind]}
              <small>{KIND_BLURB[kind]}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Palette({
  armed,
  linkKind,
  onShapePointerDown,
  onLink,
}: {
  armed: NodeKind | null;
  linkKind: EdgeKind;
  onShapePointerDown: (kind: NodeKind, event: PointerEvent<HTMLButtonElement>) => void;
  onLink: (kind: EdgeKind) => void;
}) {
  return (
    <aside className="palette" aria-label="Shapes and links">
      <p className="kicker">Drag onto a lane</p>
      <Group title="Flow" kinds={FLOW} armed={armed} onPointerDown={onShapePointerDown} />
      <Group title="Branch" kinds={BRANCH} armed={armed} onPointerDown={onShapePointerDown} />
      <Group title="Records" kinds={RECORDS} armed={armed} onPointerDown={onShapePointerDown} />
      <div className="section-label">
        <span className="kicker">Links</span>
      </div>
      <div className="stack">
        {EDGE_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={linkKind === kind ? "palette-item is-on" : "palette-item"}
            aria-pressed={linkKind === kind}
            onClick={() => onLink(kind)}
          >
            <LinkSwatch kind={kind} />
            <span>
              {EDGE_LABEL[kind]}
              <small>{EDGE_BLURB[kind]}</small>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 px-1 text-sm text-pretty text-muted">
        Tap a shape to arm it, or drag it onto a lane. Pick a link, then pull from a port.
      </p>
    </aside>
  );
}

function LinkSwatch({ kind }: { kind: EdgeKind }) {
  const dashed = kind === "message" || kind === "association" || kind === "async";
  const width = kind === "default" ? 3 : 1.75;
  return (
    <svg width="42" height="30" aria-hidden>
      <line
        x1="4"
        y1="15"
        x2="32"
        y2="15"
        stroke="var(--color-line)"
        strokeWidth={width}
        strokeDasharray={kind === "message" ? "5 3" : kind === "association" ? "1.5 3" : kind === "async" ? "7 3 1.5 3" : undefined}
        strokeLinecap="round"
      />
      {kind !== "association" && (
        <path
          d={dashed && kind !== "message" ? "M28 10 L36 15 L28 20" : "M28 10 L37 15 L28 20 Z"}
          fill={kind === "async" ? "none" : "var(--color-line)"}
          stroke="var(--color-line)"
          strokeWidth="1.4"
        />
      )}
      {kind === "conditional" && (
        <text x="14" y="10" fontSize="9" fill="var(--color-copper)" fontFamily="IBM Plex Mono, monospace">
          ?
        </text>
      )}
    </svg>
  );
}
