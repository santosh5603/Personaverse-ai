"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface GraphPersona {
  personaId: number;
  traits: { age: string; profession: string; personality: string; commStyle: string };
  scores: { attention: number; trust: number; engagement: number; likelihoodToAct: number };
  reasoning: string;
}

type NodeType = "root" | "cluster" | "persona";

interface GNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  cluster: string;
  persona?: GraphPersona;
  fixed?: boolean;
}

interface GLink {
  source: string;
  target: string;
}

// Distinct hues per personality cluster.
const CLUSTER_COLORS: Record<string, string> = {
  Analytical: "#3b82f6",
  Skeptical: "#ef4444",
  Pragmatic: "#14b8a6",
  Impulsive: "#f59e0b",
  "Trend-Driven": "#ec4899",
  Optimistic: "#22c55e",
  "Community-Minded": "#8b5cf6",
};

function clusterColor(name: string): string {
  return CLUSTER_COLORS[name] ?? "#64748b";
}

function personaMean(p: GraphPersona): number {
  const s = p.scores;
  return (s.attention + s.trust + s.engagement + s.likelihoodToAct) / 4;
}

function buildGraph(personas: GraphPersona[]): { nodes: GNode[]; links: GLink[] } {
  const nodes: GNode[] = [];
  const links: GLink[] = [];

  const root: GNode = {
    id: "root",
    type: "root",
    label: "Audience",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 26,
    cluster: "root",
  };
  nodes.push(root);

  const byCluster = new Map<string, GraphPersona[]>();
  for (const p of personas) {
    const key = p.traits.personality;
    const arr = byCluster.get(key);
    if (arr) arr.push(p);
    else byCluster.set(key, [p]);
  }

  const clusterNames = [...byCluster.keys()];
  clusterNames.forEach((name, ci) => {
    const angle = (ci / clusterNames.length) * Math.PI * 2;
    const hub: GNode = {
      id: `cluster:${name}`,
      type: "cluster",
      label: name,
      x: Math.cos(angle) * 140,
      y: Math.sin(angle) * 140,
      vx: 0,
      vy: 0,
      r: 16,
      cluster: name,
    };
    nodes.push(hub);
    links.push({ source: "root", target: hub.id });

    byCluster.get(name)!.forEach((p, pi) => {
      const a = angle + (pi - 0.5) * 0.5;
      nodes.push({
        id: `persona:${p.personaId}`,
        type: "persona",
        label: `${p.traits.age} ${p.traits.profession}`,
        x: Math.cos(a) * 260 + (Math.random() - 0.5) * 40,
        y: Math.sin(a) * 260 + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        r: 6 + (personaMean(p) / 100) * 10,
        cluster: name,
        persona: p,
      });
      links.push({ source: hub.id, target: `persona:${p.personaId}` });
    });
  });

  return { nodes, links };
}

/** One velocity-Verlet tick: repulsion + link springs + centering + damping. */
function simulate(nodes: GNode[], links: GLink[], alpha: number) {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Repulsion (O(n^2), fine for ~30 nodes).
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        d2 = 0.01;
      }
      const d = Math.sqrt(d2);
      const force = (2600 * alpha) / d2;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  // Link springs.
  for (const link of links) {
    const s = byId.get(link.source);
    const t = byId.get(link.target);
    if (!s || !t) continue;
    const desired = t.type === "persona" ? 80 : 130;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const k = (d - desired) * 0.05 * alpha;
    const fx = (dx / d) * k;
    const fy = (dy / d) * k;
    s.vx += fx;
    s.vy += fy;
    t.vx -= fx;
    t.vy -= fy;
  }

  // Integrate + centering + damping.
  for (const n of nodes) {
    if (n.fixed) {
      n.vx = 0;
      n.vy = 0;
      continue;
    }
    n.vx += -n.x * 0.006 * alpha;
    n.vy += -n.y * 0.006 * alpha;
    n.vx *= 0.85;
    n.vy *= 0.85;
    n.x += n.vx;
    n.y += n.vy;
  }
}

export default function PersonaGraph({ personas }: { personas: GraphPersona[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const graphRef = useRef(buildGraph(personas));
  const alphaRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: string | null }>({ id: null });
  const panRef = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number }>({
    active: false,
    sx: 0,
    sy: 0,
    ox: 0,
    oy: 0,
  });

  const [, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [selected, setSelected] = useState<GraphPersona | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Render client-only: the initial layout uses Math.random(), which would
  // otherwise mismatch between SSR and hydration.
  useEffect(() => setMounted(true), []);

  // Animation loop.
  useEffect(() => {
    if (!mounted) return;
    function loop() {
      if (alphaRef.current > 0.02) {
        simulate(graphRef.current.nodes, graphRef.current.links, alphaRef.current);
        alphaRef.current *= 0.99;
        setTick((t) => t + 1);
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mounted]);

  const reheat = useCallback(() => {
    alphaRef.current = Math.max(alphaRef.current, 0.4);
  }, []);

  // Convert a screen point to graph coordinates (centered origin).
  const toGraph = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const cx = clientX - rect.left - rect.width / 2;
      const cy = clientY - rect.top - rect.height / 2;
      return { x: (cx - view.x) / view.k, y: (cy - view.y) / view.k };
    },
    [view],
  );

  function onPointerDownNode(e: React.PointerEvent, node: GNode) {
    e.stopPropagation();
    if (node.type === "persona" && node.persona) setSelected(node.persona);
    dragRef.current.id = node.id;
    node.fixed = true;
    reheat();
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragRef.current.id) {
      const n = graphRef.current.nodes.find((x) => x.id === dragRef.current.id);
      if (n) {
        const p = toGraph(e.clientX, e.clientY);
        n.x = p.x;
        n.y = p.y;
        n.vx = 0;
        n.vy = 0;
        reheat();
      }
    } else if (panRef.current.active) {
      setView((v) => ({
        ...v,
        x: panRef.current.ox + (e.clientX - panRef.current.sx),
        y: panRef.current.oy + (e.clientY - panRef.current.sy),
      }));
    }
  }

  function endDragOrPan() {
    if (dragRef.current.id) {
      const n = graphRef.current.nodes.find((x) => x.id === dragRef.current.id);
      if (n && n.type !== "root") n.fixed = false;
      dragRef.current.id = null;
    }
    panRef.current.active = false;
  }

  function onBackgroundPointerDown(e: React.PointerEvent) {
    panRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      ox: view.x,
      oy: view.y,
    };
  }

  function onWheel(e: React.WheelEvent) {
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setView((v) => ({ ...v, k: Math.min(3, Math.max(0.3, v.k * factor)) }));
  }

  const { nodes, links } = graphRef.current;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  if (!mounted) {
    return (
      <div className="flex h-[460px] w-full items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
        Loading persona map…
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        className="h-[460px] w-full touch-none rounded-lg border bg-muted/20"
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDragOrPan}
        onPointerLeave={endDragOrPan}
        onWheel={onWheel}
      >
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
          <g
            transform={`translate(${(svgRef.current?.clientWidth ?? 0) / 2 / view.k}, ${
              (svgRef.current?.clientHeight ?? 0) / 2 / view.k
            })`}
          >
            {links.map((l, i) => {
              const s = byId.get(l.source);
              const t = byId.get(l.target);
              if (!s || !t) return null;
              return (
                <line
                  key={i}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke="currentColor"
                  strokeOpacity={0.15}
                  strokeWidth={t.type === "persona" ? 1 : 1.5}
                />
              );
            })}

            {nodes.map((n) => {
              const isHover = hovered === n.id;
              const isSel =
                n.type === "persona" && selected?.personaId === n.persona?.personaId;
              const fill =
                n.type === "root"
                  ? "#0f172a"
                  : n.type === "cluster"
                    ? clusterColor(n.cluster)
                    : clusterColor(n.cluster);
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  onPointerDown={(e) => onPointerDownNode(e, n)}
                  onPointerEnter={() => setHovered(n.id)}
                  onPointerLeave={() => setHovered((h) => (h === n.id ? null : h))}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    r={n.r}
                    fill={fill}
                    fillOpacity={n.type === "persona" ? 0.85 : 1}
                    stroke={isSel ? "#0f172a" : "white"}
                    strokeWidth={isSel ? 3 : 1.5}
                  />
                  {(n.type !== "persona" || isHover || isSel) && (
                    <text
                      textAnchor="middle"
                      y={n.r + 12}
                      fontSize={n.type === "root" ? 13 : 11}
                      fontWeight={n.type === "root" ? 700 : 500}
                      fill="currentColor"
                    >
                      {n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
        Drag nodes • scroll to zoom • drag canvas to pan • click a persona
      </div>

      {selected && (
        <div className="absolute right-3 top-3 w-64 rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur">
          <div className="flex items-start justify-between">
            <span
              className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
              style={{ background: clusterColor(selected.traits.personality) }}
            >
              {selected.traits.personality}
            </span>
            <button
              onClick={() => setSelected(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <p className="mt-2 text-sm font-medium">
            {selected.traits.age} · {selected.traits.profession}
          </p>
          <p className="text-xs text-muted-foreground">
            {selected.traits.commStyle} communicator
          </p>
          <div className="mt-3 space-y-1.5">
            {(
              [
                ["Attention", selected.scores.attention],
                ["Trust", selected.scores.trust],
                ["Engagement", selected.scores.engagement],
                ["Act", selected.scores.likelihoodToAct],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-16 text-xs text-muted-foreground">{label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${val}%` }}
                  />
                </div>
                <span className="w-7 text-right text-xs tabular-nums">{val}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t pt-2 text-xs italic text-muted-foreground">
            “{selected.reasoning}”
          </p>
        </div>
      )}
    </div>
  );
}
