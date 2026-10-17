import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Glyph } from "@/components/flume/glyph";
import type { StudioApi } from "@/lib/flume/store";
import { EDGE_KINDS, EDGE_LABEL, KIND_LABEL, NODE_KINDS } from "@/lib/flume/types";
import type { EdgeKind, NodeKind } from "@/lib/flume/types";

export function Inspector({ studio }: { studio: StudioApi }) {
  const { diagram, selected, scriptLock } = studio;
  const node = selected?.kind === "node" ? diagram.nodes.find((item) => item.id === selected.ids[0]) : undefined;
  const edge = selected?.kind === "edge" ? diagram.edges.find((item) => item.id === selected.ids[0]) : undefined;
  const lane = selected?.kind === "lane" ? diagram.lanes.find((item) => item.id === selected.ids[0]) : undefined;

  return (
    <section className="inspector" aria-label="Inspector">
      {node && (
        <div className="stack">
          <p className="kicker">Step</p>
          <label className="stack">
            <span className="text-sm text-muted">Label</span>
            <input
              className="field"
              value={node.label}
              disabled={scriptLock}
              onFocus={() => studio.mark()}
              onChange={(event) => studio.live((diagram) => studio.updateNode(diagram, node.id, { label: event.target.value }))}
              onBlur={() => studio.seal()}
            />
          </label>
          <div className="stack">
            <span className="text-sm text-muted">Kind</span>
            <div className="kind-grid">
              {NODE_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={node.kind === kind ? "palette-item is-on" : "palette-item"}
                  disabled={scriptLock}
                  onClick={() => studio.commit((diagram) => studio.updateNode(diagram, node.id, { kind }))}
                >
                  <Glyph kind={kind as NodeKind} w={36} h={24} />
                  <span>{KIND_LABEL[kind]}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="stack">
            <span className="text-sm text-muted">Lane</span>
            <select
              className="select"
              value={node.laneId}
              disabled={scriptLock}
              onChange={(event) =>
                studio.commit((diagram) => studio.updateNode(diagram, node.id, { laneId: event.target.value }))
              }
            >
              {diagram.lanes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-line"
            disabled={scriptLock}
            onClick={() => {
              studio.commit((diagram) => studio.removeSelection(diagram, { kind: "node", ids: [node.id] }));
              studio.select(null);
            }}
          >
            <Trash2 size={16} />
            Remove step
          </button>
        </div>
      )}

      {edge && (
        <div className="stack">
          <p className="kicker">Link</p>
          <p className="text-sm text-muted">
            {edge.from} to {edge.to}
          </p>
          <label className="stack">
            <span className="text-sm text-muted">Label</span>
            <input
              className="field"
              value={edge.label}
              placeholder={edge.kind === "conditional" ? "Yes" : "Optional"}
              disabled={scriptLock}
              onFocus={() => studio.mark()}
              onChange={(event) => studio.live((diagram) => studio.updateEdge(diagram, edge.id, { label: event.target.value }))}
              onBlur={() => studio.seal()}
            />
          </label>
          <div className="stack">
            <span className="text-sm text-muted">Type</span>
            {EDGE_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={edge.kind === kind ? "btn btn-line is-on" : "btn btn-line"}
                disabled={scriptLock}
                onClick={() => {
                  studio.setLinkKind(kind);
                  studio.commit((diagram) => studio.updateEdge(diagram, edge.id, { kind: kind as EdgeKind }));
                }}
              >
                {EDGE_LABEL[kind]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-line"
            disabled={scriptLock}
            onClick={() => {
              studio.commit((diagram) => studio.removeSelection(diagram, { kind: "edge", ids: [edge.id] }));
              studio.select(null);
            }}
          >
            <Trash2 size={16} />
            Remove link
          </button>
        </div>
      )}

      {lane && (
        <LaneFields studio={studio} laneId={lane.id} />
      )}

      {!node && !edge && !lane && (
        <div className="stack">
          <p className="kicker">Map</p>
          <p className="text-sm text-pretty text-muted">
            {diagram.nodes.length} steps · {diagram.edges.length} links · {diagram.lanes.length} lanes. Saved on this device.
          </p>
          <div className="row-between">
            <span className="text-sm">Lanes</span>
            <button type="button" className="btn btn-sm btn-line" disabled={scriptLock} onClick={() => studio.commit(studio.addLane)}>
              <Plus size={15} />
              Add
            </button>
          </div>
          {diagram.lanes.map((item, index) => (
            <div key={item.id} className="row-between">
              <button type="button" className="btn btn-sm" onClick={() => studio.select({ kind: "lane", ids: [item.id] })}>
                {item.name}
              </button>
              <span className="flex">
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`Move ${item.name} up`}
                  disabled={scriptLock || index === 0}
                  onClick={() => studio.commit((diagram) => studio.moveLane(diagram, item.id, -1))}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`Move ${item.name} down`}
                  disabled={scriptLock || index === diagram.lanes.length - 1}
                  onClick={() => studio.commit((diagram) => studio.moveLane(diagram, item.id, 1))}
                >
                  <ChevronDown size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LaneFields({ studio, laneId }: { studio: StudioApi; laneId: string }) {
  const lane = studio.diagram.lanes.find((item) => item.id === laneId);
  if (!lane) return null;
  const index = studio.diagram.lanes.findIndex((item) => item.id === laneId);
  return (
    <div className="stack">
      <p className="kicker">Lane</p>
      <label className="stack">
        <span className="text-sm text-muted">Name</span>
        <input
          className="field"
          value={lane.name}
          disabled={studio.scriptLock}
          onFocus={() => studio.mark()}
          onChange={(event) => studio.live((diagram) => studio.updateLane(diagram, lane.id, { name: event.target.value }))}
          onBlur={() => studio.seal()}
        />
      </label>
      <label className="stack">
        <span className="text-sm text-muted">Parallel group</span>
        <input
          className="field"
          value={lane.group ?? ""}
          placeholder="In parallel"
          disabled={studio.scriptLock}
          onFocus={() => studio.mark()}
          onChange={(event) => studio.live((diagram) => studio.updateLane(diagram, lane.id, { group: event.target.value }))}
          onBlur={() => studio.seal()}
        />
      </label>
      <label className="stack">
        <span className="row-between text-sm text-muted">
          <span>Depth</span>
          <span className="tabular-nums">{lane.size}</span>
        </span>
        <input
          type="range"
          min={120}
          max={360}
          value={lane.size}
          disabled={studio.scriptLock}
          onPointerDown={() => studio.mark()}
          onPointerUp={() => studio.seal()}
          onChange={(event) => studio.live((diagram) => studio.updateLane(diagram, lane.id, { size: Number(event.target.value) }))}
        />
      </label>
      <div className="row-between">
        <button
          type="button"
          className="btn btn-line btn-sm"
          disabled={studio.scriptLock || index === 0}
          onClick={() => studio.commit((diagram) => studio.moveLane(diagram, lane.id, -1))}
        >
          <ChevronUp size={15} />
          Earlier
        </button>
        <button
          type="button"
          className="btn btn-line btn-sm"
          disabled={studio.scriptLock || index === studio.diagram.lanes.length - 1}
          onClick={() => studio.commit((diagram) => studio.moveLane(diagram, lane.id, 1))}
        >
          <ChevronDown size={15} />
          Later
        </button>
      </div>
      <button
        type="button"
        className="btn btn-line"
        disabled={studio.scriptLock || studio.diagram.lanes.length <= 1}
        onClick={() => {
          studio.commit((diagram) => studio.deleteLane(diagram, lane.id));
          studio.select(null);
        }}
      >
        <Trash2 size={16} />
        Remove lane
      </button>
    </div>
  );
}
