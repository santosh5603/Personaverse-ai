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

// Vibrant, cohesive designer palette per personality cluster.
const CLUSTER_COLORS: Record<string, string> = {
  Analytical: "#3b82f6",
  Skeptical: "#f43f5e",
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

  nodes.push({
    id: "root",
    type: "root",
    label: "Audience",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 30,
    cluster: "root",
  });

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
      x: Math.cos(angle) * 150,
      y: Math.sin(angle) * 150,
      vx: 0,
      vy: 0,
      r: 13,
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
        x: Math.cos(a) * 280 + (Math.random() - 0.5) * 40,
        y: Math.sin(a) * 280 + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        r: 6 + (personaMean(p) / 100) * 11,
        cluster: name,
        persona: p,
      });
      links.push({ source: hub.id, target: `persona:${p.personaId}` });
    });
  });

  return { nodes, links };
}

function simulate(nodes: GNode[], links: GLink[], alpha: number) {
  const byId = new Map(nodes.map((n) => [n.id, n]));

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
      const force = (2900 * alpha) / d2;
      a.vx += (dx / d) * force;
      a.vy += (dy / d) * force;
      b.vx -= (dx / d) * force;
      b.vy -= (dy / d) * force;
    }
  }

  for (const link of links) {
    const s = byId.get(link.source);
    const t = byId.get(link.target);
    if (!s || !t) continue;
    const desired = t.type === "persona" ? 90 : 140;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const k = (d - desired) * 0.05 * alpha;
    s.vx += (dx / d) * k;
    s.vy += (dy / d) * k;
    t.vx -= (dx / d) * k;
    t.vy -= (dy / d) * k;
  }

  for (const n of nodes) {
    if (n.fixed || n.type === "root") {
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

/** Gentle quadratic curve between two points for an organic link look. */
function curve(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const off = len * 0.12;
  const cx = mx + (-dy / len) * off;
  const cy = my + (dx / len) * off;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export default function PersonaGraph({ personas }: { personas: GraphPersona[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const graphRef = useRef(buildGraph(personas));
  const alphaRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: string | null }>({ id: null });
  const panRef = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  const [, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [selected, setSelected] = useState<GraphPersona | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

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

  const toGraph = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const scale = rect.width / svg.viewBox.baseVal.width || 1;
      const cx = clientX - rect.left - rect.width / 2;
      const cy = clientY - rect.top - rect.height / 2;
      return { x: (cx - view.x * scale) / (view.k * scale), y: (cy - view.y * scale) / (view.k * scale) };
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
    panRef.current = { active: true, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
  }

  function onWheel(e: React.WheelEvent) {
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setView((v) => ({ ...v, k: Math.min(3, Math.max(0.3, v.k * factor)) }));
  }

  const { nodes, links } = graphRef.current;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const clusterLegend = [...new Set(personas.map((p) => p.traits.personality))];

  if (!mounted) {
    return (
      <div className="flex h-[520px] w-full items-center justify-center rounded-2xl border bg-muted/20 text-sm text-muted-foreground">
        Loading persona map…
      </div>
    );
  }

  const isAdjacent = (l: GLink) =>
    hovered != null && (l.source === hovered || l.target === hovered);
  const selId = selected ? `persona:${selected.personaId}` : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-[radial-gradient(ellipse_at_center,hsl(var(--muted)/0.5),hsl(var(--background)))]">
      <svg
        ref={svgRef}
        viewBox="0 0 900 520"
        className="h-[520px] w-full touch-none"
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDragOrPan}
        onPointerLeave={endDragOrPan}
        onWheel={onWheel}
      >
        <defs>
          <filter id="pg-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="pg-root" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--primary)/0.65)" />
          </radialGradient>
          {clusterLegend.map((c) => (
            <radialGradient key={c} id={`pg-${c.replace(/\W/g, "")}`} cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor={clusterColor(c)} stopOpacity={0.95} />
              <stop offset="100%" stopColor={clusterColor(c)} stopOpacity={0.55} />
            </radialGradient>
          ))}
        </defs>

        <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
          <g transform="translate(450, 260)">
            {/* links */}
            {links.map((l, i) => {
              const s = byId.get(l.source);
              const t = byId.get(l.target);
              if (!s || !t) return null;
              const adj = isAdjacent(l);
              return (
                <path
                  key={i}
                  d={curve(s.x, s.y, t.x, t.y)}
                  fill="none"
                  stroke={adj ? clusterColor(t.cluster) : "currentColor"}
                  strokeOpacity={adj ? 0.7 : 0.14}
                  strokeWidth={adj ? 1.6 : t.type === "persona" ? 0.8 : 1.2}
                />
              );
            })}

            {/* nodes */}
            {nodes.map((n) => {
              const isHover = hovered === n.id;
              const isSel = n.id === selId;
              const gradId =
                n.type === "root"
                  ? "pg-root"
                  : `pg-${n.cluster.replace(/\W/g, "")}`;
              const scale = isHover || isSel ? 1.25 : 1;
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  onPointerDown={(e) => onPointerDownNode(e, n)}
                  onPointerEnter={() => setHovered(n.id)}
                  onPointerLeave={() => setHovered((h) => (h === n.id ? null : h))}
                  style={{ cursor: "pointer" }}
                >
                  {/* halo */}
                  {(n.type !== "persona" || isHover || isSel) && (
                    <circle
                      r={n.r * scale + 5}
                      fill={n.type === "root" ? "hsl(var(--primary))" : clusterColor(n.cluster)}
                      opacity={0.18}
                    />
                  )}
                  <circle
                    r={n.r * scale}
                    fill={`url(#${gradId})`}
                    stroke={isSel ? "white" : "hsl(var(--background))"}
                    strokeWidth={isSel ? 2.5 : 1.5}
                    filter={n.type !== "persona" ? "url(#pg-glow)" : undefined}
                  />
                  {n.type === "cluster" && (
                    <circle r={n.r * scale * 0.4} fill="white" fillOpacity={0.9} />
                  )}
                  {(n.type !== "persona" || isHover || isSel) && (
                    <text
                      textAnchor="middle"
                      y={n.r * scale + 14}
                      fontSize={n.type === "root" ? 14 : 11.5}
                      fontWeight={n.type === "root" ? 700 : 600}
                      fill="currentColor"
                      style={{ pointerEvents: "none" }}
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

      {/* hint */}
      <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-background/70 px-2.5 py-1.5 text-xs text-muted-foreground backdrop-blur">
        Drag nodes · scroll to zoom · click a persona
      </div>

      {/* legend */}
      <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-background/70 px-3 py-2 text-[11px] backdrop-blur">
        {clusterLegend.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: clusterColor(c) }} />
            {c}
          </span>
        ))}
      </div>

      {/* detail panel */}
      {selected && (
        <div className="absolute right-4 top-4 w-64 rounded-xl border bg-background/95 p-4 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between">
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
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
          <p className="mt-2 text-sm font-semibold">
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
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${val}%`,
                      background: clusterColor(selected.traits.personality),
                    }}
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
