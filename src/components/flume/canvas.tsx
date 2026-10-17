import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Glyph } from "@/components/flume/glyph";
import {
  groupRuns,
  laneOrigin,
  nodeBox,
  pointsToPath,
  routeEdge,
  selfPath,
  slashAt,
  worldSize,
  type Side,
} from "@/lib/flume/geometry";
import { addNode, moveNodes, placeLane, updateLane, updateNode, type DragOrigin } from "@/lib/flume/ops";
import { useStudio } from "@/lib/flume/store";
import type { Diagram, FlowNode, NodeKind } from "@/lib/flume/types";
import { HEADER_COL, HEADER_ROW, KIND_LABEL } from "@/lib/flume/types";

export type CanvasHandle = {
  contains: (x: number, y: number) => boolean;
  dropShape: (kind: NodeKind, x: number, y: number) => boolean;
  fit: () => void;
  zoomBy: (factor: number) => void;
};

type View = { zoom: number; x: number; y: number };
type LinkDrag = { from: string; x: number; y: number; hover: string | null };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export const Canvas = forwardRef<CanvasHandle, { tool: "select" | "pan" }>(function Canvas({ tool }, ref) {
  const studio = useStudio();
  const studioRef = useRef(studio);
  studioRef.current = studio;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ zoom: 0.86, x: 20, y: 20 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [link, setLink] = useState<LinkDrag | null>(null);
  const [panning, setPanning] = useState(false);
  const [space, setSpace] = useState(false);
  const spaceRef = useRef(false);
  const [vp, setVp] = useState({ w: 800, h: 600 });
  const diagram = studio.diagram;
  const world = worldSize(diagram);

  function clientToWorld(cx: number, cy: number) {
    const rect = viewportRef.current?.getBoundingClientRect();
    const current = viewRef.current;
    if (!rect) return { x: 0, y: 0 };
    return { x: (cx - rect.left - current.x) / current.zoom, y: (cy - rect.top - current.y) / current.zoom };
  }

  function applyView(next: View) {
    viewRef.current = next;
    setView(next);
  }

  function zoomAt(cx: number, cy: number, nextZoom: number) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const current = viewRef.current;
    const zoom = clamp(nextZoom, 0.28, 1.8);
    const wx = (cx - rect.left - current.x) / current.zoom;
    const wy = (cy - rect.top - current.y) / current.zoom;
    applyView({ zoom, x: cx - rect.left - wx * zoom, y: cy - rect.top - wy * zoom });
  }

  function fit() {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const size = worldSize(studioRef.current.diagram);
    const zoom = clamp(Math.min(0.95, (rect.height - 36) / Math.max(size.h, 1)), 0.35, 0.95);
    applyView({ zoom, x: 18, y: Math.max(12, (rect.height - size.h * zoom) / 2) });
  }

  useLayoutEffect(() => {
    fit();
    // Refit when the map identity or lane direction changes, not on every drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram.id, diagram.orientation]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setVp({ w: rect.width, h: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) zoomAt(event.clientX, event.clientY, viewRef.current.zoom * Math.exp(-event.deltaY * 0.0016));
      else {
        const next = { ...viewRef.current, x: viewRef.current.x - event.deltaX, y: viewRef.current.y - event.deltaY };
        applyView(next);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTyping(event.target)) return;
      event.preventDefault();
      spaceRef.current = true;
      setSpace(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spaceRef.current = false;
      setSpace(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  function hitNode(x: number, y: number) {
    let found: string | null = null;
    for (const node of studioRef.current.diagram.nodes) {
      const box = nodeBox(studioRef.current.diagram, node);
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) found = node.id;
    }
    return found;
  }

  useImperativeHandle(ref, () => ({
    contains(cx: number, cy: number) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return false;
      return cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom;
    },
    dropShape(kind: NodeKind, cx: number, cy: number) {
      const api = studioRef.current;
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect || api.scriptLock) return false;
      if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) return false;
      const point = clientToWorld(cx, cy);
      let created = "";
      api.commit((current) => {
        const result = addNode(current, kind, point.x - 24, point.y - 24);
        created = result.id;
        return result.diagram;
      });
      if (created) api.select({ kind: "node", ids: [created] });
      api.arm(null);
      return true;
    },
    fit,
    zoomBy(factor: number) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, viewRef.current.zoom * factor);
    },
  }));

  function onBackgroundPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button === 1 || tool === "pan" || spaceRef.current) {
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const origin = { ...viewRef.current };
      setPanning(true);
      const move = (ev: PointerEvent) => {
        applyView({ ...origin, x: origin.x + ev.clientX - startX, y: origin.y + ev.clientY - startY });
      };
      const up = () => {
        setPanning(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return;
    }
    if (event.button !== 0) return;
    const api = studioRef.current;
    if (api.armed && !api.scriptLock) {
      const point = clientToWorld(event.clientX, event.clientY);
      let created = "";
      api.commit((current) => {
        const result = addNode(current, api.armed as NodeKind, point.x - 24, point.y - 24);
        created = result.id;
        return result.diagram;
      });
      if (created) api.select({ kind: "node", ids: [created] });
      api.arm(null);
      return;
    }
    api.select(null);
  }

  function onNodePointerDown(event: ReactPointerEvent, id: string) {
    event.stopPropagation();
    if (event.button !== 0) return;
    const api = studioRef.current;
    if (api.scriptLock || event.detail > 1) {
      api.select({ kind: "node", ids: [id] });
      return;
    }
    let ids = api.selected?.kind === "node" ? api.selected.ids.slice() : [];
    if (event.shiftKey) {
      ids = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
      api.select(ids.length ? { kind: "node", ids } : null);
      return;
    }
    if (!ids.includes(id)) ids = [id];
    api.select({ kind: "node", ids });
    api.mark();
    const origins: DragOrigin[] = api.diagram.nodes
      .filter((node) => ids.includes(node.id))
      .map((node) => {
        const box = nodeBox(api.diagram, node);
        return { id: node.id, x: box.x, y: box.y };
      });
    const start = clientToWorld(event.clientX, event.clientY);
    let moved = false;
    const move = (ev: PointerEvent) => {
      const now = clientToWorld(ev.clientX, ev.clientY);
      const dx = now.x - start.x;
      const dy = now.y - start.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      studioRef.current.live((current) => moveNodes(current, origins, dx, dy));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      studioRef.current.seal();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onPortPointerDown(event: ReactPointerEvent, id: string) {
    event.stopPropagation();
    event.preventDefault();
    if (studioRef.current.scriptLock) return;
    const start = clientToWorld(event.clientX, event.clientY);
    setLink({ from: id, x: start.x, y: start.y, hover: null });
    const move = (ev: PointerEvent) => {
      const point = clientToWorld(ev.clientX, ev.clientY);
      setLink({ from: id, x: point.x, y: point.y, hover: hitNode(point.x, point.y) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const point = clientToWorld(ev.clientX, ev.clientY);
      const target = hitNode(point.x, point.y);
      const api = studioRef.current;
      if (target) {
        let edgeId = "";
        api.commit((current) => {
          const before = new Set(current.edges.map((edge) => edge.id));
          const next = api.addEdge(current, id, target, api.linkKind);
          edgeId = next.edges.find((edge) => !before.has(edge.id))?.id ?? "";
          return next;
        });
        if (edgeId) api.select({ kind: "edge", ids: [edgeId] });
      }
      setLink(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onLanePointerDown(event: ReactPointerEvent, laneId: string) {
    event.stopPropagation();
    if (event.button !== 0) return;
    const api = studioRef.current;
    api.select({ kind: "lane", ids: [laneId] });
    if (api.scriptLock) return;
    const lane = api.diagram.lanes.find((item) => item.id === laneId);
    const startIndex = api.diagram.lanes.findIndex((item) => item.id === laneId);
    if (!lane || startIndex < 0) return;
    api.mark();
    const start = clientToWorld(event.clientX, event.clientY);
    const axis = api.diagram.orientation === "rows" ? start.y : start.x;
    const move = (ev: PointerEvent) => {
      const now = clientToWorld(ev.clientX, ev.clientY);
      const delta = (api.diagram.orientation === "rows" ? now.y : now.x) - axis;
      const steps = Math.trunc(delta / Math.max(80, lane.size * 0.55));
      const target = clamp(startIndex + steps, 0, studioRef.current.diagram.lanes.length - 1);
      studioRef.current.live((current) => placeLane(current, laneId, target));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      studioRef.current.seal();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onResizePointerDown(event: ReactPointerEvent, laneId: string) {
    event.stopPropagation();
    event.preventDefault();
    const api = studioRef.current;
    if (api.scriptLock || event.button !== 0) return;
    api.mark();
    const move = (ev: PointerEvent) => {
      const point = clientToWorld(ev.clientX, ev.clientY);
      studioRef.current.live((current) => {
        const index = current.lanes.findIndex((lane) => lane.id === laneId);
        if (index < 0) return current;
        const origin = laneOrigin(current, index);
        const size = current.orientation === "rows" ? point.y - origin : point.x - origin;
        return updateLane(current, laneId, { size });
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      studioRef.current.seal();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const selectedNodes = new Set(studio.selected?.kind === "node" ? studio.selected.ids : []);
  const selectedEdge = studio.selected?.kind === "edge" ? studio.selected.ids[0] : null;
  const selectedLane = studio.selected?.kind === "lane" ? studio.selected.ids[0] : null;
  const rows = diagram.orientation === "rows";
  const header = rows ? HEADER_ROW : HEADER_COL;

  let cursor = "";
  if (panning) cursor = "is-panning";
  else if (space || tool === "pan") cursor = "is-space";
  else if (studio.armed) cursor = "is-armed";

  return (
    <div className="canvas-wrap">
      <div
        ref={viewportRef}
        className={`viewport ${cursor}`}
        onPointerDown={onBackgroundPointerDown}
        role="application"
        aria-label="Flow canvas"
      >
        <div
          className={link ? "world is-linking" : "world"}
          style={{ width: world.w, height: world.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        >
          {diagram.lanes.map((lane, index) => {
            const origin = laneOrigin(diagram, index);
            const style = rows
              ? { top: origin, left: header, width: world.w - header, height: lane.size }
              : { left: origin, top: header, width: lane.size, height: world.h - header };
            return (
              <div
                key={lane.id}
                style={{
                  position: "absolute",
                  background: index % 2 ? "var(--color-canvas)" : "var(--color-lane)",
                  ...style,
                }}
              />
            );
          })}
          {diagram.lanes.map((lane, index) => {
            const origin = laneOrigin(diagram, index);
            const style = rows
              ? { top: origin, left: 0, width: header, height: lane.size }
              : { left: origin, top: 0, width: lane.size, height: header };
            return (
              <div
                key={lane.id}
                className={`lane-header${rows ? "" : " is-col"}${selectedLane === lane.id ? " is-selected" : ""}`}
                style={style}
                onPointerDown={(event) => onLanePointerDown(event, lane.id)}
                role="button"
                tabIndex={0}
                aria-label={`${lane.name} lane`}
              >
                <span className="lane-index">{String(index + 1).padStart(2, "0")}</span>
                <strong>{lane.name}</strong>
                {lane.group ? <span className="text-xs opacity-70">{lane.group}</span> : null}
              </div>
            );
          })}
          {diagram.lanes.map((lane, index) => {
            const origin = laneOrigin(diagram, index);
            const style = rows
              ? { top: origin + lane.size - 4, left: header, width: world.w - header, height: 8, cursor: "row-resize" }
              : { left: origin + lane.size - 4, top: header, width: 8, height: world.h - header, cursor: "col-resize" };
            return (
              <div
                key={`${lane.id}-resize`}
                className="lane-resizer"
                style={style}
                onPointerDown={(event) => onResizePointerDown(event, lane.id)}
                aria-hidden
              />
            );
          })}
          <Brackets diagram={diagram} world={world} />
          <svg
            width={world.w}
            height={world.h}
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
            aria-hidden={diagram.edges.length === 0}
          >
            <defs>
              <marker id="arrow-ink" viewBox="0 0 10 8" markerWidth="9" markerHeight="7" refX="9" refY="4" orient="auto">
                <path d="M0 0 L10 4 L0 8 Z" fill="var(--color-line)" />
              </marker>
              <marker id="arrow-open" viewBox="0 0 10 8" markerWidth="9" markerHeight="7" refX="9" refY="4" orient="auto">
                <path d="M1 1 L9 4 L1 7" fill="none" stroke="var(--color-line)" strokeWidth="1.4" />
              </marker>
              <marker id="arrow-copper" viewBox="0 0 10 8" markerWidth="9" markerHeight="7" refX="9" refY="4" orient="auto">
                <path d="M0 0 L10 4 L0 8 Z" fill="var(--color-copper)" />
              </marker>
            </defs>
            {diagram.edges.map((edge) => {
              const from = diagram.nodes.find((node) => node.id === edge.from);
              const to = diagram.nodes.find((node) => node.id === edge.to);
              if (!from || !to) return null;
              const self = edge.from === edge.to;
              const routed = routeEdge(nodeBox(diagram, from), nodeBox(diagram, to), self);
              const d = self ? selfPath(routed.points) : pointsToPath(routed.points);
              const selected = selectedEdge === edge.id;
              const stroke = selected ? "var(--color-copper)" : "var(--color-line)";
              const marker =
                edge.kind === "association"
                  ? undefined
                  : edge.kind === "async" || edge.kind === "message"
                    ? "url(#arrow-open)"
                    : selected
                      ? "url(#arrow-copper)"
                      : "url(#arrow-ink)";
              const text = edge.label || (edge.kind === "conditional" ? "?" : "");
              const slash = edge.kind === "default" ? slashAt(routed.points) : null;
              const dash =
                edge.kind === "message" ? "7 5" : edge.kind === "association" ? "1.5 4" : edge.kind === "async" ? "11 4 2 4" : undefined;
              return (
                <g key={edge.id}>
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      studio.select({ kind: "edge", ids: [edge.id] });
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={edge.kind === "default" ? 2.7 : 1.7}
                    strokeDasharray={dash}
                    markerEnd={marker}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                  {slash && (
                    <line
                      x1={slash.x1}
                      y1={slash.y1}
                      x2={slash.x2}
                      y2={slash.y2}
                      stroke={stroke}
                      strokeWidth={1.7}
                      pointerEvents="none"
                    />
                  )}
                  {text && (
                    <g pointerEvents="none">
                      <rect
                        x={routed.label.x - text.length * 3.6 - 6}
                        y={routed.label.y - 9}
                        width={text.length * 7.2 + 12}
                        height={18}
                        rx={6}
                        fill="var(--color-chip)"
                        stroke="var(--color-rule)"
                      />
                      <text
                        x={routed.label.x}
                        y={routed.label.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--color-ink)"
                        className="edge-label"
                      >
                        {text}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            {link && <LinkRibbon diagram={diagram} link={link} kind={studio.linkKind} />}
          </svg>
          {diagram.nodes.map((node) => (
            <NodeView
              key={node.id}
              diagram={diagram}
              node={node}
              selected={selectedNodes.has(node.id) || link?.hover === node.id}
              locked={studio.scriptLock}
              onPointerDown={onNodePointerDown}
              onPortPointerDown={onPortPointerDown}
              onLabel={(label) => studio.commit((current) => updateNode(current, node.id, { label }))}
            />
          ))}
        </div>
      </div>
      <Minimap
        diagram={diagram}
        view={view}
        viewport={vp}
        onJump={(wx, wy) => {
          const rect = viewportRef.current?.getBoundingClientRect();
          if (!rect) return;
          const zoom = viewRef.current.zoom;
          applyView({ zoom, x: rect.width / 2 - wx * zoom, y: rect.height / 2 - wy * zoom });
        }}
      />
      {studio.scriptLock && (
        <div className="banner">
          <span>Script edit has the map. Pan and zoom still work.</span>
        </div>
      )}
      {!studio.scriptLock && studio.armed && (
        <div className="banner">
          <span>Tap a lane to drop {KIND_LABEL[studio.armed]}.</span>
          <button type="button" className="btn btn-sm" onClick={() => studio.arm(null)}>
            Cancel
          </button>
        </div>
      )}
      {!studio.scriptLock && !studio.armed && studio.hint && (
        <div className="banner">
          <span className="hint-dot" />
          <span>Drag shapes onto lanes. Pull a port to link. The script rewrites itself.</span>
          <button type="button" className="btn btn-sm" onClick={studio.dismissHint}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
});

function LinkRibbon({ diagram, link, kind }: { diagram: Diagram; link: LinkDrag; kind: string }) {
  const from = diagram.nodes.find((node) => node.id === link.from);
  if (!from) return null;
  const routed = routeEdge(nodeBox(diagram, from), { x: link.x, y: link.y, w: 1, h: 1 }, false);
  const dash = kind === "message" ? "7 5" : kind === "association" ? "1.5 4" : kind === "async" ? "11 4 2 4" : undefined;
  return (
    <path
      d={pointsToPath(routed.points)}
      fill="none"
      stroke="var(--color-copper)"
      strokeWidth={1.8}
      strokeDasharray={dash ?? "4 4"}
      pointerEvents="none"
    />
  );
}

function portStyle(side: Side): { left: string | number; top: string | number } {
  if (side === "n") return { left: "50%", top: 0 };
  if (side === "s") return { left: "50%", top: "100%" };
  if (side === "w") return { left: 0, top: "50%" };
  return { left: "100%", top: "50%" };
}

function NodeView({
  diagram,
  node,
  selected,
  locked,
  onPointerDown,
  onPortPointerDown,
  onLabel,
}: {
  diagram: Diagram;
  node: FlowNode;
  selected: boolean;
  locked: boolean;
  onPointerDown: (event: ReactPointerEvent, id: string) => void;
  onPortPointerDown: (event: ReactPointerEvent, id: string) => void;
  onLabel: (label: string) => void;
}) {
  const box = nodeBox(diagram, node);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.label);
  useEffect(() => setDraft(node.label), [node.label]);
  return (
    <div
      className={selected ? `flow-node is-selected kind-${node.kind}` : `flow-node kind-${node.kind}`}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      role="button"
      tabIndex={0}
      aria-label={`${KIND_LABEL[node.kind]}: ${node.label}`}
      aria-pressed={selected}
      onPointerDown={(event) => onPointerDown(event, node.id)}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!locked) setEditing(true);
      }}
    >
      <Glyph kind={node.kind} w={node.w} h={node.h} selected={selected} />
      <div className="node-label">
        {editing ? (
          <input
            className="node-edit"
            value={draft}
            autoFocus
            aria-label="Step label"
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              setEditing(false);
              if (draft.trim() && draft !== node.label) onLabel(draft.trim());
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setDraft(node.label);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span>{node.label}</span>
        )}
      </div>
      {!locked &&
        (["n", "e", "s", "w"] as Side[]).map((side) => (
          <button
            key={side}
            type="button"
            className="port"
            style={portStyle(side)}
            aria-label={`Draw a link from ${node.label}`}
            onPointerDown={(event) => onPortPointerDown(event, node.id)}
          />
        ))}
    </div>
  );
}

function Brackets({ diagram, world }: { diagram: Diagram; world: { w: number; h: number } }) {
  return groupRuns(diagram).map((run) => {
    let start = 0;
    for (let i = 0; i < run.from; i++) start += diagram.lanes[i].size;
    let span = 0;
    for (let i = run.from; i <= run.to; i++) span += diagram.lanes[i].size;
    if (diagram.orientation === "rows") {
      return (
        <div key={`${run.label}-${run.from}`} className="bracket bracket-rows" style={{ top: start + 10, height: Math.max(24, span - 20), left: world.w - 34 }}>
          <span>{run.label}</span>
        </div>
      );
    }
    return (
      <div key={`${run.label}-${run.from}`} className="bracket bracket-cols" style={{ left: start + 10, width: Math.max(24, span - 20), top: world.h - 30 }}>
        <span>{run.label}</span>
      </div>
    );
  });
}

function Minimap({
  diagram,
  view,
  viewport,
  onJump,
}: {
  diagram: Diagram;
  view: View;
  viewport: { w: number; h: number };
  onJump: (x: number, y: number) => void;
}) {
  const world = worldSize(diagram);
  const mw = 168;
  const mh = clamp((mw * world.h) / Math.max(world.w, 1), 52, 112);
  const sx = mw / world.w;
  const sy = mh / world.h;
  const vx = -view.x / view.zoom;
  const vy = -view.y / view.zoom;
  return (
    <button
      type="button"
      className="minimap"
      aria-label="Overview. Click to pan."
      onPointerDown={(event) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const pad = 6;
        onJump(((event.clientX - rect.left - pad) / mw) * world.w, ((event.clientY - rect.top - pad) / mh) * world.h);
      }}
    >
      <svg width={mw} height={mh} aria-hidden>
        <rect width={mw} height={mh} fill="var(--color-canvas)" />
        {diagram.lanes.map((lane, index) => {
          const origin = laneOrigin(diagram, index);
          if (diagram.orientation === "rows") {
            return <rect key={lane.id} x={0} y={origin * sy} width={mw} height={lane.size * sy} fill={index % 2 ? "var(--color-canvas)" : "var(--color-lane)"} />;
          }
          return <rect key={lane.id} x={origin * sx} y={0} width={lane.size * sx} height={mh} fill={index % 2 ? "var(--color-canvas)" : "var(--color-lane)"} />;
        })}
        {diagram.nodes.map((node) => {
          const box = nodeBox(diagram, node);
          return <rect key={node.id} x={box.x * sx} y={box.y * sy} width={Math.max(2, box.w * sx)} height={Math.max(2, box.h * sy)} fill="var(--color-ink)" rx={1} />;
        })}
        <rect
          x={vx * sx}
          y={vy * sy}
          width={Math.max(8, (viewport.w / view.zoom) * sx)}
          height={Math.max(8, (viewport.h / view.zoom) * sy)}
          fill="none"
          stroke="var(--color-copper)"
          strokeWidth={1.5}
        />
      </svg>
    </button>
  );
}
