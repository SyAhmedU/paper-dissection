// FacetTimeline — the cross-paper view, modelled on TheoryScope's Timeline.
// Swimlanes are FACETS (Theory, Design, Measures, Analysis, Software…) instead
// of disciplines; the X-axis is publication year; each node is an item a paper
// used, coloured by paper. So you can scan, e.g., the "Analysis" lane and see
// every technique used across your corpus and when. Deterministic layout, no
// force simulation. Click a node to open that paper's card.

import { useMemo, useState } from 'react';
import type { Dissection, FacetKey } from '../lib/types';
import { FACETS } from '../lib/types';

// Distinct, theme-stable colours assigned per paper.
const PAPER_COLORS = [
  '#F14575', '#9270F4', '#FF9656', '#22d3ee', '#1b8a5a', '#c97a1a',
  '#2e6cf6', '#ec4899', '#10b981', '#6366f1', '#dc2626', '#0ea5e9',
];

const TIMELINE_FACETS = FACETS.filter(f => f.inTimeline);

const MARGIN = { top: 36, right: 28, bottom: 44, left: 150 };
const LANE_H = 76;
const NODE_R = 6;
const NODE_R_HOVER = 9;
const W = 1120;

interface Node {
  paperId: string;
  paperTitle: string;
  facet: FacetKey;
  text: string;
  detail?: string;
  year: number;
  color: string;
  x: number;
  y: number;
}

export default function FacetTimeline({ dissections, onOpen }: { dissections: Dissection[]; onOpen: (id: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<FacetKey>>(new Set());

  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    dissections.forEach((d, i) => m.set(d.id, PAPER_COLORS[i % PAPER_COLORS.length]));
    return m;
  }, [dissections]);

  const withYear = dissections.filter(d => typeof d.year === 'number');
  const noYearCount = dissections.length - withYear.length;

  const { minYear, maxYear } = useMemo(() => {
    const years = withYear.map(d => d.year as number);
    if (!years.length) return { minYear: 2000, maxYear: 2025 };
    return { minYear: Math.min(...years) - 1, maxYear: Math.max(...years) + 1 };
  }, [withYear]);

  // Which lanes actually have items.
  const lanes = useMemo(() =>
    TIMELINE_FACETS.filter(f => withYear.some(d => (d.facets[f.key]?.length ?? 0) > 0)),
    [withYear]);

  const { nodes } = useMemo(() => {
    const innerW = W - MARGIN.left - MARGIN.right;
    const span = (maxYear - minYear) || 1;
    const xFor = (y: number) => MARGIN.left + ((y - minYear) / span) * innerW;
    const laneIdx: Record<string, number> = {};
    lanes.forEach((f, i) => { laneIdx[f.key] = i; });

    const out: Node[] = [];
    // Per-lane collision rows so nodes near the same year stack instead of overlapping.
    const laneRowEnds: Record<number, number[]> = {};
    const sorted = [...withYear].sort((a, b) => (a.year as number) - (b.year as number));
    for (const d of sorted) {
      for (const f of lanes) {
        const items = d.facets[f.key] ?? [];
        const idx = laneIdx[f.key];
        for (const it of items) {
          const x = xFor(d.year as number);
          laneRowEnds[idx] ||= [];
          let row = 0;
          while (laneRowEnds[idx][row] !== undefined && x - laneRowEnds[idx][row] < 16) row++;
          laneRowEnds[idx][row] = x;
          const baseY = MARGIN.top + idx * LANE_H + LANE_H / 2;
          const y = baseY + (row - 1.5) * 13;
          out.push({
            paperId: d.id, paperTitle: d.title, facet: f.key, text: it.text, detail: it.detail,
            year: d.year as number, color: colorOf.get(d.id) || '#888', x, y,
          });
        }
      }
    }
    return { nodes: out };
  }, [withYear, lanes, minYear, maxYear, colorOf]);

  const ticks = useMemo(() => {
    const span = maxYear - minYear;
    const step = span <= 12 ? 1 : span <= 30 ? 5 : 10;
    const start = Math.ceil(minYear / step) * step;
    const out: number[] = [];
    for (let y = start; y <= maxYear; y += step) out.push(y);
    return out;
  }, [minYear, maxYear]);

  if (!dissections.length) {
    return <div className="empty">Dissect a few papers and they'll appear here on the facet × year timeline.</div>;
  }
  if (!lanes.length) {
    return <div className="empty">No dated papers with timeline-able facets yet. Add papers with a publication year (DOI or full text).</div>;
  }

  const plotH = MARGIN.top + lanes.length * LANE_H + MARGIN.bottom;
  const innerW = W - MARGIN.left - MARGIN.right;
  const span = (maxYear - minYear) || 1;
  const xFor = (y: number) => MARGIN.left + ((y - minYear) / span) * innerW;
  const isVisible = (k: FacetKey) => !hidden.has(k);
  const toggle = (k: FacetKey) => setHidden(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div>
      <p className="muted" style={{ maxWidth: 760, marginTop: 0 }}>
        Every dissected item plotted at its paper's year, swimlaned by facet and coloured by paper.
        Scan a lane to see which theories, methods, tools and measures appear across your corpus — and when.
        Click a node to open that paper.
      </p>

      <div className="pdw-filters">
        <span className="label" style={{ margin: 0 }}>Facet</span>
        {lanes.map(f => (
          <button key={f.key} className={`chip ${isVisible(f.key) ? 'on' : ''}`} onClick={() => toggle(f.key)} style={{ borderColor: f.color }}>
            <span className="chip-dot" style={{ background: f.color }} />{f.icon} {f.label}
          </button>
        ))}
      </div>

      <div className="pdw-legend">
        {dissections.map(d => (
          <button key={d.id} className="pdw-legend-item" onClick={() => onOpen(d.id)} title={d.title}>
            <span className="chip-dot" style={{ background: colorOf.get(d.id) }} />
            <span className="pdw-legend-name">{d.year ? `${d.year} · ` : ''}{shortTitle(d.title)}</span>
          </button>
        ))}
      </div>

      <div className="pdw-scroll">
        <svg viewBox={`0 0 ${W} ${plotH}`} style={{ width: '100%', minWidth: 860, height: plotH, display: 'block' }}>
          {lanes.map((f, i) => (
            <rect key={`bg-${f.key}`} x={MARGIN.left} y={MARGIN.top + i * LANE_H} width={innerW} height={LANE_H}
              fill={i % 2 === 0 ? 'var(--bg-soft)' : 'transparent'} opacity={isVisible(f.key) ? 1 : 0.25} />
          ))}
          {ticks.map(y => (
            <g key={`tick-${y}`}>
              <line x1={xFor(y)} y1={MARGIN.top} x2={xFor(y)} y2={MARGIN.top + lanes.length * LANE_H} stroke="var(--line)" strokeOpacity={0.7} />
              <text x={xFor(y)} y={MARGIN.top - 12} textAnchor="middle" fontSize={11} fill="var(--ink-mute)">{y}</text>
              <text x={xFor(y)} y={MARGIN.top + lanes.length * LANE_H + 18} textAnchor="middle" fontSize={11} fill="var(--ink-mute)">{y}</text>
            </g>
          ))}
          {lanes.map((f, i) => (
            <text key={`lbl-${f.key}`} x={MARGIN.left - 12} y={MARGIN.top + i * LANE_H + LANE_H / 2 + 4}
              textAnchor="end" fontSize={12} fontWeight={600}
              fill={isVisible(f.key) ? 'var(--ink)' : 'var(--ink-mute)'} opacity={isVisible(f.key) ? 1 : 0.4}>
              {f.icon} {f.label}
            </text>
          ))}
          {nodes.map((n, i) => {
            const vis = isVisible(n.facet);
            const id = `${n.paperId}-${n.facet}-${i}`;
            const isHov = hovered === id;
            return (
              <g key={id} style={{ cursor: 'pointer' }} opacity={vis ? 1 : 0.12}
                onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)}
                onClick={() => onOpen(n.paperId)}>
                <circle cx={n.x} cy={n.y} r={isHov ? NODE_R_HOVER : NODE_R} fill={n.color} stroke="var(--bg-elev)" strokeWidth={1.5} />
                {isHov && (
                  <g>
                    <rect x={n.x + 10} y={n.y - 34} width={Math.max(n.text.length * 6.6 + 24, 150)} height={44} rx={8}
                      fill="var(--bg-elev)" stroke="var(--line)" />
                    <text x={n.x + 18} y={n.y - 18} fontSize={12} fontWeight={700} fill="var(--ink)">{clip(n.text, 30)}</text>
                    <text x={n.x + 18} y={n.y - 3} fontSize={10.5} fill="var(--ink-mute)">{clip(n.paperTitle, 34)} · {n.year}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="muted small" style={{ marginTop: 8 }}>
        {nodes.length} items · {withYear.length} dated papers · {lanes.length} facet lanes · {minYear + 1}–{maxYear - 1}
        {noYearCount > 0 && <> · <span className="dc-ev-warn">{noYearCount} paper(s) without a year are not shown</span></>}
      </div>
    </div>
  );
}

function clip(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function shortTitle(s: string): string { return clip(s, 28); }
