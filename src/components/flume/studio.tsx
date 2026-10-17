import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  AlignHorizontalDistributeCenter,
  BookOpen,
  Columns3,
  Copy,
  FileCode2,
  ImageDown,
  Hand,
  Maximize2,
  MousePointer2,
  Plus,
  Redo2,
  Rows3,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Canvas, type CanvasHandle } from "@/components/flume/canvas";
import { CodePane } from "@/components/flume/code-pane";
import { Glyph } from "@/components/flume/glyph";
import { Inspector } from "@/components/flume/inspector";
import { Palette } from "@/components/flume/palette";
import { serialize } from "@/lib/flume/language";
import { duplicateNodes, nudge, removeSelection, setOrientation, setTitle } from "@/lib/flume/ops";
import { StudioProvider, useStudio } from "@/lib/flume/store";
import { diagramToSvg, downloadText, slugify } from "@/lib/flume/svg-export";
import { KIND_DEFAULT, type NodeKind } from "@/lib/flume/types";

type Sheet = "shapes" | "inspect" | "script" | "map" | null;

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select"));
}

export function Studio() {
  return (
    <StudioProvider>
      <StudioFrame />
    </StudioProvider>
  );
}

function StudioFrame() {
  const studio = useStudio();
  const studioRef = useRef(studio);
  studioRef.current = studio;
  const canvasRef = useRef<CanvasHandle>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [mapsOpen, setMapsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ghost, setGhost] = useState<{ kind: NodeKind; x: number; y: number } | null>(null);
  const { diagram } = studio;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const api = studioRef.current;
      if (isTyping(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) api.redo();
        else api.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        api.redo();
        return;
      }
      if (mod && event.key.toLowerCase() === "d" && api.selected?.kind === "node") {
        event.preventDefault();
        const source = api.selected.ids;
        let ids: string[] = [];
        api.commit((current) => {
          const result = duplicateNodes(current, source);
          ids = result.ids;
          return result.diagram;
        });
        if (ids.length) api.select({ kind: "node", ids });
        return;
      }
      if (mod && event.key === "0") {
        event.preventDefault();
        canvasRef.current?.fit();
        return;
      }
      if (event.key === "Escape") {
        api.arm(null);
        api.select(null);
        setSheet(null);
        setMapsOpen(false);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && api.selected && !api.scriptLock) {
        event.preventDefault();
        const selected = api.selected;
        api.commit((current) => removeSelection(current, selected));
        api.select(null);
        return;
      }
      if (event.key.startsWith("Arrow") && api.selected?.kind === "node" && !api.scriptLock) {
        event.preventDefault();
        const step = event.shiftKey ? 16 : 8;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        const ids = api.selected.ids;
        api.commit((current) => nudge(current, ids, dx, dy));
        return;
      }
      if (event.key === "?" ) helpRef.current?.showModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onShapePointerDown(kind: NodeKind, event: ReactPointerEvent<HTMLButtonElement>) {
    if (studio.scriptLock) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) moved = true;
      setGhost({ kind, x: ev.clientX, y: ev.clientY });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setGhost(null);
      if (moved) {
        const placed = canvasRef.current?.dropShape(kind, ev.clientX, ev.clientY);
        if (placed) setSheet(null);
        else studioRef.current.arm(kind);
      } else {
        const api = studioRef.current;
        api.arm(api.armed === kind ? null : kind);
        setSheet(null);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async function copyScript() {
    const text = serialize(studio.diagram);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      downloadText(`${slugify(studio.diagram.title)}.flume`, text, "text/plain");
    }
  }

  function toggle(next: Sheet) {
    setSheet((current) => (current === next ? null : next));
  }

  return (
    <div className="studio">
      <header className="studio-header">
        <div className="wordmark">
          <span className="text-ink" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 22 22">
              <rect x="1" y="3" width="20" height="3.2" rx="1" fill="currentColor" opacity="0.88" />
              <rect x="1" y="9.4" width="20" height="3.2" rx="1" fill="currentColor" />
              <rect x="1" y="15.8" width="20" height="3.2" rx="1" fill="currentColor" opacity="0.45" />
              <circle cx="14.5" cy="11" r="2.2" fill="var(--color-copper)" />
            </svg>
          </span>
          <div className="hide-sm">
            <h1>Flume</h1>
            <p>Swimlane studio</p>
          </div>
        </div>
        <div className="map-menu">
          <button type="button" className="btn btn-line btn-sm" aria-expanded={mapsOpen} onClick={() => setMapsOpen((open) => !open)}>
            Maps
          </button>
          {mapsOpen && (
            <div className="map-pop" role="menu">
              {studio.diagrams.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === diagram.id ? "btn is-on" : "btn"}
                  onClick={() => {
                    studio.switchMap(item.id);
                    setMapsOpen(false);
                  }}
                >
                  {item.title}
                </button>
              ))}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  studio.newMap();
                  setMapsOpen(false);
                }}
              >
                <Plus size={15} /> New map
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  studio.duplicateMap();
                  setMapsOpen(false);
                }}
              >
                <Copy size={15} /> Duplicate
              </button>
              <button
                type="button"
                className="btn"
                disabled={studio.diagrams.length <= 1}
                onClick={() => {
                  studio.deleteMap();
                  setMapsOpen(false);
                }}
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>
          )}
        </div>
        <input
          className="title-input"
          aria-label="Map title"
          value={diagram.title}
          disabled={studio.scriptLock}
          onFocus={() => studio.mark()}
          onChange={(event) => studio.live((current) => setTitle(current, event.target.value))}
          onBlur={() => {
            studio.live((current) => setTitle(current, current.title.trim() || "Untitled map"));
            studio.seal();
          }}
        />
        <div className="header-actions">
          <button type="button" className="btn btn-icon" aria-label="Undo" disabled={!studio.canUndo} onClick={studio.undo}>
            <Undo2 size={16} />
          </button>
          <button type="button" className="btn btn-icon hide-sm" aria-label="Redo" disabled={!studio.canRedo} onClick={studio.redo}>
            <Redo2 size={16} />
          </button>
          <button
            type="button"
            className={tool === "select" ? "btn btn-icon is-on" : "btn btn-icon"}
            aria-label="Select tool"
            aria-pressed={tool === "select"}
            onClick={() => setTool("select")}
          >
            <MousePointer2 size={16} />
          </button>
          <button
            type="button"
            className={tool === "pan" ? "btn btn-icon is-on" : "btn btn-icon"}
            aria-label="Pan tool"
            aria-pressed={tool === "pan"}
            onClick={() => setTool("pan")}
          >
            <Hand size={16} />
          </button>
          <button
            type="button"
            className="btn btn-icon hide-sm"
            aria-label="Tidy layout"
            disabled={studio.scriptLock}
            onClick={() => studio.commit(studio.applyTidy)}
          >
            <AlignHorizontalDistributeCenter size={16} />
          </button>
          <button
            type="button"
            className={diagram.orientation === "rows" ? "btn btn-icon is-on hide-sm" : "btn btn-icon hide-sm"}
            aria-label="Horizontal lanes"
            aria-pressed={diagram.orientation === "rows"}
            onClick={() => studio.commit((current) => setOrientation(current, "rows"))}
          >
            <Rows3 size={16} />
          </button>
          <button
            type="button"
            className={diagram.orientation === "columns" ? "btn btn-icon is-on hide-sm" : "btn btn-icon hide-sm"}
            aria-label="Vertical lanes"
            aria-pressed={diagram.orientation === "columns"}
            onClick={() => studio.commit((current) => setOrientation(current, "columns"))}
          >
            <Columns3 size={16} />
          </button>
          <button type="button" className="btn btn-icon hide-sm" aria-label="Zoom out" onClick={() => canvasRef.current?.zoomBy(1 / 1.12)}>
            <ZoomOut size={16} />
          </button>
          <button type="button" className="btn btn-icon hide-sm" aria-label="Zoom in" onClick={() => canvasRef.current?.zoomBy(1.12)}>
            <ZoomIn size={16} />
          </button>
          <button type="button" className="btn btn-icon" aria-label="Fit map" onClick={() => canvasRef.current?.fit()}>
            <Maximize2 size={16} />
          </button>
          <button type="button" className="btn btn-sm btn-line hide-sm" aria-label="Copy script" onClick={() => void copyScript()}>
            <Copy size={15} />
            <span className="wide-label">{copied ? "Copied" : "Script"}</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-line hide-sm"
            aria-label="Download Flume script"
            onClick={() => downloadText(`${slugify(diagram.title)}.flume`, serialize(diagram), "text/plain")}
          >
            <FileCode2 size={15} />
            <span className="wide-label">.flume</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-copper hide-sm"
            aria-label="Download SVG"
            onClick={() => downloadText(`${slugify(diagram.title)}.svg`, diagramToSvg(diagram), "image/svg+xml")}
          >
            <ImageDown size={15} />
            <span className="wide-label">SVG</span>
          </button>
          <button type="button" className="btn btn-icon" aria-label="Flume dialect" onClick={() => helpRef.current?.showModal()}>
            <BookOpen size={16} />
          </button>
        </div>
      </header>

      <div className="palette-slot">
        <Palette
          armed={studio.armed}
          linkKind={studio.linkKind}
          onShapePointerDown={onShapePointerDown}
          onLink={studio.setLinkKind}
        />
      </div>
      <div className="canvas-slot">
        <Canvas ref={canvasRef} tool={tool} />
        {sheet === "shapes" && (
          <div className="mobile-sheet">
            <Palette
              armed={studio.armed}
              linkKind={studio.linkKind}
              onShapePointerDown={onShapePointerDown}
              onLink={studio.setLinkKind}
            />
          </div>
        )}
        {sheet === "inspect" && (
          <div className="mobile-sheet">
            <Inspector studio={studio} />
          </div>
        )}
        {sheet === "script" && (
          <div className="mobile-sheet">
            <CodePane studio={studio} />
          </div>
        )}
        {sheet === "map" && (
          <div className="mobile-sheet">
            <div className="stack sheet-pad">
              <p className="kicker">This map</p>
              <div className="row-between">
                <button type="button" className={diagram.orientation === "rows" ? "btn btn-line is-on" : "btn btn-line"} onClick={() => studio.commit((current) => setOrientation(current, "rows"))}>
                  <Rows3 size={16} /> Rows
                </button>
                <button type="button" className={diagram.orientation === "columns" ? "btn btn-line is-on" : "btn btn-line"} onClick={() => studio.commit((current) => setOrientation(current, "columns"))}>
                  <Columns3 size={16} /> Columns
                </button>
              </div>
              <button type="button" className="btn btn-line" disabled={studio.scriptLock} onClick={() => studio.commit(studio.applyTidy)}>
                Tidy layout
              </button>
              <button type="button" className="btn btn-line" onClick={() => canvasRef.current?.zoomBy(1.12)}>
                <ZoomIn size={16} /> Zoom in
              </button>
              <button type="button" className="btn btn-line" onClick={() => canvasRef.current?.zoomBy(1 / 1.12)}>
                <ZoomOut size={16} /> Zoom out
              </button>
              <button type="button" className="btn btn-line" onClick={() => void copyScript()}>
                <Copy size={16} /> {copied ? "Copied" : "Copy script"}
              </button>
              <button type="button" className="btn btn-line" onClick={() => downloadText(`${slugify(diagram.title)}.flume`, serialize(diagram), "text/plain")}>
                <FileCode2 size={16} /> Download .flume
              </button>
              <button type="button" className="btn btn-copper" onClick={() => downloadText(`${slugify(diagram.title)}.svg`, diagramToSvg(diagram), "image/svg+xml")}>
                <ImageDown size={16} /> Download SVG
              </button>
            </div>
          </div>
        )}
        {ghost && (
          <div className="ghost" style={{ left: ghost.x, top: ghost.y }}>
            <Glyph kind={ghost.kind} w={KIND_DEFAULT[ghost.kind].w * 0.72} h={KIND_DEFAULT[ghost.kind].h * 0.72} />
          </div>
        )}
      </div>
      <aside className="side-slot">
        <Inspector studio={studio} />
        <CodePane studio={studio} />
      </aside>

      <nav className="studio-nav" aria-label="Mobile tools">
        <button type="button" className={sheet === "shapes" ? "btn is-on" : "btn"} onClick={() => toggle("shapes")}>
          Shapes
        </button>
        <button type="button" className={sheet === "inspect" ? "btn is-on" : "btn"} onClick={() => toggle("inspect")}>
          Inspect
        </button>
        <button type="button" className={sheet === "script" ? "btn is-on" : "btn"} onClick={() => toggle("script")}>
          Script
        </button>
        <button type="button" className={sheet === "map" ? "btn is-on" : "btn"} onClick={() => toggle("map")}>
          Map
        </button>
      </nav>

      <dialog ref={helpRef} className="sheet-dialog" onClick={(event) => { if (event.target === helpRef.current) helpRef.current?.close(); }}>
        <div className="modal">
          <div className="row-between">
            <h2>Flume dialect</h2>
            <button type="button" className="btn btn-icon" aria-label="Close" onClick={() => helpRef.current?.close()}>
              ×
            </button>
          </div>
          <p className="mt-2 text-pretty text-muted">
            A stricter cousin of Mermaid. Lanes are real objects, arrows name the kind of link, and every drag rewrites the script. Edit the script and the map follows.
          </p>
          <pre className="mt-3">{`dialect flume/1
flow "Admission desk"
direction rows

lane patient "Patient" size 152
lane billing "Billing" size 156 group "In parallel"

node start arrive "Arrives" lane patient at 28,49 size 148x54
node decision acuity "Urgent?" lane triage at 460,30 size 156x112

edge arrive --> consent
edge consent -.-> vitals "Chart"
edge acuity ?-> exam "Yes"
edge pick ~~> label "Notify"`}</pre>
          <div className="mt-3 stack text-sm">
            <p>
              <strong>{"-->"}</strong> sequence · <strong>{"-.->"}</strong> message · <strong>{"?->"}</strong> conditional
            </p>
            <p>
              <strong>{"==>"}</strong> default · <strong>{"..>"}</strong> association · <strong>{"~~>"}</strong> async
            </p>
            <p className="text-muted">Undo, delete, arrows to nudge, ⌘/Ctrl+D duplicate, space to pan, ⌘/Ctrl+scroll to zoom.</p>
          </div>
        </div>
      </dialog>
    </div>
  );
}
