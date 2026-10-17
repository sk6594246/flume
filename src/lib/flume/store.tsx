import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { parse } from "./language";
import {
  addEdge,
  addLane,
  addNode,
  applyTidy,
  deleteLane,
  duplicateNodes,
  moveLane,
  moveNodes,
  nudge,
  placeLane,
  removeSelection,
  sameDiagram,
  setOrientation,
  setTitle,
  updateEdge,
  updateLane,
  updateNode,
  type DragOrigin,
} from "./ops";
import { isDiagram, seedLibrary, blankMap } from "./templates";
import type { Diagram, EdgeKind, NodeKind, Orientation } from "./types";

const STORAGE_KEY = "flume.library.v1";
const HINT_KEY = "flume.hint.dismissed";

export type Selection = { kind: "node" | "edge" | "lane"; ids: string[] } | null;

type State = {
  persist: boolean;
  activeId: string;
  diagrams: Diagram[];
  past: string[];
  future: string[];
  pending: string | null;
  selected: Selection;
  linkKind: EdgeKind;
  armed: NodeKind | null;
  scriptLock: boolean;
  hint: boolean;
};

type Action =
  | { type: "load"; activeId: string; diagrams: Diagram[]; hint: boolean }
  | { type: "mark" }
  | { type: "seal" }
  | { type: "discard" }
  | { type: "live"; recipe: (diagram: Diagram) => Diagram }
  | { type: "commit"; recipe: (diagram: Diagram) => Diagram }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; selected: Selection }
  | { type: "link"; kind: EdgeKind }
  | { type: "arm"; kind: NodeKind | null }
  | { type: "lock"; value: boolean }
  | { type: "hint" }
  | { type: "switch"; id: string }
  | { type: "new-map" }
  | { type: "duplicate-map" }
  | { type: "delete-map" };

function activeOf(state: State): Diagram {
  return state.diagrams.find((diagram) => diagram.id === state.activeId) ?? state.diagrams[0];
}

function prune(selected: Selection, diagram: Diagram): Selection {
  if (!selected) return null;
  const ids =
    selected.kind === "node"
      ? selected.ids.filter((id) => diagram.nodes.some((node) => node.id === id))
      : selected.kind === "edge"
        ? selected.ids.filter((id) => diagram.edges.some((edge) => edge.id === id))
        : selected.ids.filter((id) => diagram.lanes.some((lane) => lane.id === id));
  return ids.length ? { kind: selected.kind, ids } : null;
}

function writeDiagram(state: State, diagram: Diagram): State {
  return {
    ...state,
    diagrams: state.diagrams.map((item) => (item.id === state.activeId ? diagram : item)),
    selected: prune(state.selected, diagram),
  };
}

function reducer(state: State, action: Action): State {
  if (action.type === "load") {
    return {
      ...state,
      persist: true,
      activeId: action.activeId,
      diagrams: action.diagrams,
      past: [],
      future: [],
      pending: null,
      selected: null,
      hint: action.hint,
    };
  }
  const current = activeOf(state);
  if (action.type === "mark") {
    if (state.pending) return state;
    return { ...state, pending: JSON.stringify(current) };
  }
  if (action.type === "seal") {
    if (!state.pending) return state;
    if (state.pending === JSON.stringify(current)) return { ...state, pending: null };
    return {
      ...state,
      pending: null,
      future: [],
      past: [...state.past, state.pending].slice(-80),
    };
  }
  if (action.type === "discard") return { ...state, pending: null };
  if (action.type === "live") {
    const next = action.recipe(current);
    if (sameDiagram(next, current)) return state;
    return writeDiagram(state, { ...next, id: current.id });
  }
  if (action.type === "commit") {
    const next = action.recipe(current);
    if (sameDiagram(next, current)) return state;
    return {
      ...writeDiagram(state, { ...next, id: current.id }),
      pending: null,
      future: [],
      past: [...state.past, JSON.stringify(current)].slice(-80),
    };
  }
  if (action.type === "undo") {
    if (state.scriptLock || !state.past.length) return state;
    const previous = JSON.parse(state.past[state.past.length - 1]) as Diagram;
    return {
      ...writeDiagram(state, previous),
      past: state.past.slice(0, -1),
      future: [JSON.stringify(current), ...state.future],
      pending: null,
    };
  }
  if (action.type === "redo") {
    if (state.scriptLock || !state.future.length) return state;
    const next = JSON.parse(state.future[0]) as Diagram;
    return {
      ...writeDiagram(state, next),
      future: state.future.slice(1),
      past: [...state.past, JSON.stringify(current)].slice(-80),
      pending: null,
    };
  }
  if (action.type === "select") return { ...state, selected: action.selected };
  if (action.type === "link") return { ...state, linkKind: action.kind };
  if (action.type === "arm") return { ...state, armed: action.kind };
  if (action.type === "lock") return { ...state, scriptLock: action.value };
  if (action.type === "hint") return { ...state, hint: false };
  if (action.type === "switch") {
    if (!state.diagrams.some((diagram) => diagram.id === action.id)) return state;
    return { ...state, activeId: action.id, past: [], future: [], pending: null, selected: null, armed: null };
  }
  if (action.type === "new-map") {
    const id = `map-${Date.now().toString(36)}`;
    const diagram = blankMap(id);
    return {
      ...state,
      diagrams: [...state.diagrams, diagram],
      activeId: id,
      past: [],
      future: [],
      pending: null,
      selected: null,
      armed: null,
    };
  }
  if (action.type === "duplicate-map") {
    const id = `map-${Date.now().toString(36)}`;
    const copy: Diagram = { ...structuredClone(current), id, title: `${current.title} copy` };
    return { ...state, diagrams: [...state.diagrams, copy], activeId: id, past: [], future: [], pending: null, selected: null };
  }
  if (action.type === "delete-map") {
    if (state.diagrams.length <= 1) return state;
    const diagrams = state.diagrams.filter((diagram) => diagram.id !== current.id);
    return {
      ...state,
      diagrams,
      activeId: diagrams[0].id,
      past: [],
      future: [],
      pending: null,
      selected: null,
    };
  }
  return state;
}

function readSaved(): { activeId: string; diagrams: Diagram[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { v?: number; activeId?: string; diagrams?: unknown[] };
    if (data.v !== 1 || !Array.isArray(data.diagrams)) return null;
    const diagrams = data.diagrams.filter(isDiagram);
    if (!diagrams.length) return null;
    const activeId = diagrams.some((diagram) => diagram.id === data.activeId) ? (data.activeId as string) : diagrams[0].id;
    return { activeId, diagrams };
  } catch {
    return null;
  }
}

const seed = seedLibrary();

const initial: State = {
  persist: false,
  activeId: seed[0].id,
  diagrams: seed,
  past: [],
  future: [],
  pending: null,
  selected: null,
  linkKind: "sequence",
  armed: null,
  scriptLock: false,
  hint: true,
};

const StudioContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    const saved = readSaved();
    const hint = localStorage.getItem(HINT_KEY) !== "1";
    if (saved) dispatch({ type: "load", ...saved, hint });
    else dispatch({ type: "load", activeId: seed[0].id, diagrams: seed, hint });
  }, []);

  useEffect(() => {
    if (!state.persist) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, activeId: state.activeId, diagrams: state.diagrams }),
    );
  }, [state.persist, state.activeId, state.diagrams]);

  useEffect(() => {
    if (!state.persist || state.hint) return;
    localStorage.setItem(HINT_KEY, "1");
  }, [state.persist, state.hint]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("Studio is missing its provider");
  const { state, dispatch } = ctx;
  const diagram = activeOf(state);

  return {
    diagrams: state.diagrams,
    diagram,
    selected: state.selected,
    linkKind: state.linkKind,
    armed: state.armed,
    scriptLock: state.scriptLock,
    hint: state.hint,
    canUndo: state.past.length > 0 && !state.scriptLock,
    canRedo: state.future.length > 0 && !state.scriptLock,
    select: (selected: Selection) => dispatch({ type: "select", selected }),
    setLinkKind: (kind: EdgeKind) => dispatch({ type: "link", kind }),
    arm: (kind: NodeKind | null) => dispatch({ type: "arm", kind }),
    setScriptLock: (value: boolean) => dispatch({ type: "lock", value }),
    dismissHint: () => dispatch({ type: "hint" }),
    mark: () => dispatch({ type: "mark" }),
    seal: () => dispatch({ type: "seal" }),
    discard: () => dispatch({ type: "discard" }),
    live: (recipe: (diagram: Diagram) => Diagram) => dispatch({ type: "live", recipe }),
    commit: (recipe: (diagram: Diagram) => Diagram) => dispatch({ type: "commit", recipe }),
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    switchMap: (id: string) => dispatch({ type: "switch", id }),
    newMap: () => dispatch({ type: "new-map" }),
    duplicateMap: () => dispatch({ type: "duplicate-map" }),
    deleteMap: () => dispatch({ type: "delete-map" }),
    applyParsed: (source: string) => {
      const parsed = parse(source, diagram.id);
      if (!parsed.ok) return parsed.errors;
      dispatch({ type: "live", recipe: () => ({ ...parsed.diagram, id: diagram.id }) });
      return null;
    },
    addEdge,
    addLane,
    addNode,
    applyTidy,
    deleteLane,
    duplicateNodes,
    moveLane,
    moveNodes,
    nudge,
    placeLane,
    removeSelection,
    setOrientation,
    setTitle,
    updateEdge,
    updateLane,
    updateNode,
  };
}

export type StudioApi = ReturnType<typeof useStudio>;
export type { DragOrigin };
