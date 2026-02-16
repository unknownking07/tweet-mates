import type { PersonalityTraits } from '@/lib/types';
import { PERSONALITY_DIMENSIONS } from '@/lib/types';

interface PersonalityRadarProps {
  traits: PersonalityTraits;
  size?: number;
  className?: string;
}

export function PersonalityRadar({ traits, size = 280, className }: PersonalityRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const labelRadius = size * 0.48;
  const n = PERSONALITY_DIMENSIONS.length;

  function polarToXY(angle: number, r: number): [number, number] {
    const rad = (angle - 90) * (Math.PI / 180);
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  function polygonPoints(r: number): string {
    return PERSONALITY_DIMENSIONS.map((_, i) => {
      const angle = (360 / n) * i;
      const [x, y] = polarToXY(angle, r);
      return `${x},${y}`;
    }).join(' ');
  }

  const dataPoints = PERSONALITY_DIMENSIONS.map((dim, i) => {
    const angle = (360 / n) * i;
    const value = traits[dim] / 100;
    return polarToXY(angle, radius * value);
  });

  const dataPolygon = dataPoints.map(([x, y]) => `${x},${y}`).join(' ');

  const labels = PERSONALITY_DIMENSIONS.map((dim, i) => {
    const angle = (360 / n) * i;
    const [x, y] = polarToXY(angle, labelRadius);
    return { dim, x, y, angle };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map((pct) => (
        <polygon
          key={pct}
          points={polygonPoints(radius * pct)}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {PERSONALITY_DIMENSIONS.map((_, i) => {
        const angle = (360 / n) * i;
        const [x, y] = polarToXY(angle, radius);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        );
      })}

      {/* Data shape */}
      <polygon
        points={dataPolygon}
        fill="rgba(225, 29, 72, 0.2)"
        stroke="#e11d48"
        strokeWidth={2}
      />

      {/* Data points */}
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#fb7185" />
      ))}

      {/* Labels */}
      {labels.map(({ dim, x, y }) => (
        <text
          key={dim}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.6)"
          fontSize={10}
          fontWeight={500}
        >
          {dim.charAt(0).toUpperCase() + dim.slice(1)}
        </text>
      ))}
    </svg>
  );
}
