import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { edgeLine, nodeLine, serialize, parse } from "@/lib/flume/language";
import type { StudioApi } from "@/lib/flume/store";
import { EDGE_KINDS, NODE_KINDS } from "@/lib/flume/types";

const KEYS = new Set([
  "dialect",
  "flow",
  "direction",
  "lane",
  "node",
  "edge",
  "size",
  "at",
  "group",
  "rows",
  "columns",
  "flume/1",
]);
const KINDS = new Set<string>([...NODE_KINDS, ...EDGE_KINDS]);

function tokens(line: string): { text: string; cls: string }[] {
  if (line.trim().startsWith("//")) return [{ text: line, cls: "tok-mute" }];
  const re =
    /"(?:\\.|[^"\\])*"|~~>|==>|\.\.>|-\.->|\?->|-->|\b\d+x\d+\b|\b\d+(?:,\d+)?\b|[A-Za-z_./][A-Za-z0-9_./]*|\s+|./g;
  const parts: { text: string; cls: string }[] = [];
  for (const match of line.matchAll(re)) {
    const text = match[0];
    let cls = "";
    if (text.startsWith('"')) cls = "tok-str";
    else if (/^(-->|-\.->|\?->|==>|\.\.>|\~\~>)$/.test(text)) cls = "tok-arrow";
    else if (/^\d/.test(text)) cls = "tok-num";
    else if (KEYS.has(text)) cls = "tok-key";
    else if (KINDS.has(text)) cls = "tok-kind";
    parts.push({ text, cls });
  }
  return parts.length ? parts : [{ text: line, cls: "" }];
}

export function CodePane({ studio }: { studio: StudioApi }) {
  const canonical = useMemo(() => serialize(studio.diagram), [studio.diagram]);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const snapshot = useRef(studio.diagram);
  const liveRef = useRef(studio.live);
  const idRef = useRef(studio.diagram.id);
  const markRef = useRef<HTMLDivElement | null>(null);
  liveRef.current = studio.live;
  idRef.current = studio.diagram.id;
  const editing = draft !== null;

  useEffect(() => {
    if (draft === null || draft === canonical) return;
    const handle = window.setTimeout(() => {
      const parsed = parse(draft, idRef.current);
      if (!parsed.ok) setError(parsed.errors.slice(0, 5).join("\n"));
      else {
        setError(null);
        liveRef.current(() => ({ ...parsed.diagram, id: idRef.current }));
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [draft, canonical]);

  const selectedId = studio.selected?.kind === "node" ? studio.selected.ids[0] : null;
  const edge = studio.selected?.kind === "edge" ? studio.diagram.edges.find((item) => item.id === studio.selected?.ids[0]) : undefined;
  const marked = editing
    ? null
    : selectedId
      ? nodeLine(canonical, selectedId)
      : edge
        ? edgeLine(canonical, edge)
        : null;

  useEffect(() => {
    if (editing) return;
    markRef.current?.scrollIntoView({ block: "nearest" });
  }, [marked, editing]);

  function begin() {
    studio.seal();
    snapshot.current = studio.diagram;
    studio.mark();
    studio.setScriptLock(true);
    setDraft(canonical);
    setError(null);
  }

  function done() {
    if (draft === null) return;
    const parsed = parse(draft, studio.diagram.id);
    if (!parsed.ok) {
      setError(parsed.errors.slice(0, 5).join("\n"));
      return;
    }
    studio.live(() => ({ ...parsed.diagram, id: studio.diagram.id }));
    studio.seal();
    studio.setScriptLock(false);
    setDraft(null);
    setError(null);
  }

  function cancel() {
    const snap = snapshot.current;
    studio.live(() => snap);
    studio.discard();
    studio.setScriptLock(false);
    setDraft(null);
    setError(null);
  }

  const lines = (editing ? draft : canonical).split("\n");

  return (
    <section className="codepane" aria-label="Flume script">
      <div className="code-head">
        <div>
          <p className="kicker" style={{ color: "var(--color-faint)" }}>
            Flume script
          </p>
          <p className="text-sm" style={{ color: "var(--color-paper)" }}>
            Lane-aware, Mermaid-adjacent
          </p>
        </div>
        <span className="code-status">{editing ? (error ? "Needs a fix" : "Editing") : "Live"}</span>
        {editing ? (
          <>
            <button type="button" className="btn btn-sm" onClick={cancel}>
              <X size={15} />
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-copper" disabled={!!error} onClick={done}>
              <Check size={15} />
              Done
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-sm" onClick={begin}>
            <Pencil size={15} />
            Edit
          </button>
        )}
      </div>
      {error && (
        <p className="px-3 py-2 text-sm whitespace-pre-wrap" style={{ color: "var(--color-danger-soft)" }}>
          {error}
        </p>
      )}
      {editing ? (
        <textarea
          className="code-editor"
          spellCheck={false}
          value={draft ?? ""}
          aria-label="Edit Flume script"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              cancel();
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              done();
            }
            if (event.key === "Tab") {
              event.preventDefault();
              const target = event.currentTarget;
              const start = target.selectionStart;
              const end = target.selectionEnd;
              const next = `${draft?.slice(0, start) ?? ""}  ${draft?.slice(end) ?? ""}`;
              setDraft(next);
              requestAnimationFrame(() => {
                target.selectionStart = start + 2;
                target.selectionEnd = start + 2;
              });
            }
          }}
        />
      ) : (
        <div className="code-scroll" onDoubleClick={begin}>
          {lines.map((line, index) => (
            <div
              key={`${index}-${line}`}
              className={marked === index ? "code-line is-mark" : "code-line"}
              ref={marked === index ? markRef : undefined}
            >
              <span className="ln">{index + 1}</span>
              <span>
                {tokens(line).map((token, tokenIndex) => (
                  <span key={tokenIndex} className={token.cls}>
                    {token.text}
                  </span>
                ))}
                {line.length === 0 ? " " : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
