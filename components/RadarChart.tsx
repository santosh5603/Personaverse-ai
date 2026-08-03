interface RadarChartProps {
  data: { label: string; value: number }[];
  size?: number;
}

// Dependency-free SVG radar/spider chart for the 4 score dimensions.
export default function RadarChart({ data, size = 240 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 34;
  const n = data.length;
  const levels = [25, 50, 75, 100];

  const pointAt = (i: number, value: number) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = (value / 100) * radius;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };

  const valuePoints = data.map((d, i) => pointAt(i, d.value));
  const polygon = valuePoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
      {/* grid rings */}
      {levels.map((lvl) => (
        <polygon
          key={lvl}
          points={data
            .map((_, i) => {
              const p = pointAt(i, lvl);
              return `${p.x},${p.y}`;
            })
            .join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.12}
        />
      ))}

      {/* spokes + labels */}
      {data.map((d, i) => {
        const outer = pointAt(i, 100);
        const labelPt = pointAt(i, 122);
        return (
          <g key={d.label}>
            <line
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke="currentColor"
              strokeOpacity={0.12}
            />
            <text
              x={labelPt.x}
              y={labelPt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fill="currentColor"
              fillOpacity={0.7}
            >
              {d.label}
            </text>
            <text
              x={pointAt(i, 100).x}
              y={pointAt(i, 100).y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={0}
            />
          </g>
        );
      })}

      {/* value polygon */}
      <polygon
        points={polygon}
        fill="hsl(var(--primary))"
        fillOpacity={0.18}
        stroke="hsl(var(--primary))"
        strokeWidth={2}
      />
      {valuePoints.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="hsl(var(--primary))" />
          <text
            x={p.x}
            y={p.y - 8}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            fill="currentColor"
          >
            {Math.round(data[i].value)}
          </text>
        </g>
      ))}
    </svg>
  );
}
