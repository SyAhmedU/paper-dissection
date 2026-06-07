// SynthesisMatrix — the cross-paper coding grid. Two orientations:
//   • Papers as columns (default): facets are ROWS (Theory used, Constructs, …)
//     with the facet-label column frozen left and paper headers frozen top, so
//     the facet rows stay locked while you scroll across papers.
//   • Papers as rows: the classic article × concept matrix (facets as columns).
// Both freeze the header row + the first column (corner pinned). Cells show each
// item with its detail; items shared by ≥2 papers are highlighted with a ×count
// (a quick synthesis signal); unverified items are dashed. Cells deep-link to
// the suite where the facet maps to one.

import { useMemo, useState } from 'react';
import type { Dissection, FacetKey, FacetItem, FacetMeta } from '../lib/types';
import { FACETS, FACET_BY_KEY, facetItemLink } from '../lib/types';
import { download, stamp, dissectionsCsv, dissectionsMarkdown } from '../lib/export';

const COLS = FACETS.filter(f => f.inMatrix);
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export default function SynthesisMatrix({ dissections, onOpen }: { dissections: Dissection[]; onOpen: (id: string) => void }) {
  const [orient, setOrient] = useState<'facetRows' | 'paperRows'>('facetRows');

  const papers = useMemo(() => [...dissections].sort((a, b) => (a.year ?? 0) - (b.year ?? 0)), [dissections]);

  // For each facet, how many papers each item-text appears in (normalised).
  const shared = useMemo(() => {
    const m = new Map<FacetKey, Map<string, number>>();
    for (const f of COLS) {
      const cm = new Map<string, number>();
      for (const p of papers) {
        const seen = new Set<string>();
        for (const it of (p.facets[f.key] || [])) {
          const k = norm(it.text);
          if (seen.has(k)) continue;
          seen.add(k);
          cm.set(k, (cm.get(k) ?? 0) + 1);
        }
      }
      m.set(f.key, cm);
    }
    return m;
  }, [papers]);

  if (!dissections.length) {
    return <div className="empty">Dissect a few papers to build the synthesis matrix — facet rows, paper columns, frozen so they stay put as you scroll.</div>;
  }

  const sharedCount = (fk: FacetKey, it: FacetItem) => shared.get(fk)?.get(norm(it.text)) ?? 0;
  const itemsFor = (p: Dissection, fk: FacetKey) => p.facets[fk] || [];
  const papersWith = (fk: FacetKey) => papers.filter(p => itemsFor(p, fk).length > 0).length;
  const itemTotal = (p: Dissection) => COLS.reduce((n, f) => n + itemsFor(p, f.key).length, 0);

  function Chip({ fk, it }: { fk: FacetKey; it: FacetItem }) {
    const link = facetItemLink(fk, it);
    const cnt = sharedCount(fk, it);
    const sh = cnt >= 2;
    const cls = `sm-chip ${it.verified ? '' : 'unverified'} ${sh ? 'shared' : ''}`;
    const title = [
      it.detail || '',
      it.evidence ? `“${it.evidence}”` : '',
      it.verified ? '' : '(unverified — not found verbatim in source)',
    ].filter(Boolean).join('  ·  ');
    const style = { ['--facet' as string]: FACET_BY_KEY[fk].color };
    const body = (
      <>
        <span className="sm-chip-text">{it.text}</span>
        {it.detail && <span className="sm-chip-detail">{it.detail}</span>}
        {sh && <span className="sm-chip-badge" title={`appears in ${cnt} papers`}>×{cnt}</span>}
      </>
    );
    return link
      ? <a className={cls} href={link} target="_blank" rel="noopener noreferrer" title={title || undefined} style={style}>{body}</a>
      : <span className={cls} title={title || undefined} style={style}>{body}</span>;
  }

  function Cell({ p, f }: { p: Dissection; f: FacetMeta }) {
    const items = itemsFor(p, f.key);
    if (!items.length) return <span className="sm-empty">—</span>;
    return <div className="sm-chips">{items.map((it, i) => <Chip key={i} fk={f.key} it={it} />)}</div>;
  }

  const PaperHead = ({ p }: { p: Dissection }) => (
    <button className="sm-paper" onClick={() => onOpen(p.id)} title="Open dissection">
      <span className="sm-paper-title">{p.title || 'Untitled'}</span>
      <span className="sm-paper-meta">
        {(p.authors?.[0]?.split(',')[0]) ?? '—'}{p.year ? ` · ${p.year}` : ''} · {itemTotal(p)} items
        <span className={`sm-depth ${p.depth}`} title={p.depth === 'full-text' ? 'Full-text dissection' : 'Abstract-depth'}>{p.depth === 'full-text' ? 'FT' : 'AB'}</span>
      </span>
    </button>
  );

  return (
    <div>
      <div className="sm-toolbar">
        <p className="muted small" style={{ margin: 0, maxWidth: 600 }}>
          Each paper's parts side by side. The facet rows and paper headers are <strong>frozen</strong> — scroll papers and they stay locked.
          Chips shared by ≥2 papers are highlighted with a ×count; dashed chips are unverified.
        </p>
        <span style={{ flex: 1 }} />
        <div className="sm-export">
          <button className="btn small" title="Download papers × facets as CSV" onClick={() => download(`synthesis-${stamp()}.csv`, dissectionsCsv(papers), 'text/csv')}>⬇ CSV</button>
          <button className="btn small" title="Download as a Markdown table" onClick={() => download(`synthesis-${stamp()}.md`, dissectionsMarkdown(papers), 'text/markdown')}>⬇ Markdown</button>
        </div>
        <div className="seg sm-seg">
          <button className={orient === 'facetRows' ? 'on' : ''} onClick={() => setOrient('facetRows')}>Papers as columns</button>
          <button className={orient === 'paperRows' ? 'on' : ''} onClick={() => setOrient('paperRows')}>Papers as rows</button>
        </div>
      </div>

      <div className="sm-scroll">
        {orient === 'facetRows' ? (
          <table className="sm-table transposed">
            <thead>
              <tr>
                <th className="sm-corner">Facet <span className="sm-corner-sep">\</span> Paper</th>
                {papers.map(p => <th key={p.id} className="sm-paperhead col"><PaperHead p={p} /></th>)}
              </tr>
            </thead>
            <tbody>
              {COLS.map(f => (
                <tr key={f.key}>
                  <th className="sm-facethead facet" scope="row" style={{ ['--facet' as string]: f.color }} title={f.blurb}>
                    <span className="sm-facet-ic">{f.icon}</span>
                    <span className="sm-facet-nm">{f.label}</span>
                    <span className="sm-facet-ct">{papersWith(f.key)}/{papers.length}</span>
                  </th>
                  {papers.map(p => <td key={p.id}><Cell p={p} f={f} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="sm-table">
            <thead>
              <tr>
                <th className="sm-corner">Paper</th>
                {COLS.map(f => (
                  <th key={f.key} className="sm-paperhead facetcol" title={f.blurb} style={{ ['--facet' as string]: f.color }}>
                    <span className="sm-col-icon">{f.icon}</span> {f.label}
                    <span className="sm-facet-ct">{papersWith(f.key)}/{papers.length}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {papers.map(p => (
                <tr key={p.id}>
                  <th className="sm-facethead paper" scope="row"><PaperHead p={p} /></th>
                  {COLS.map(f => <td key={f.key}><Cell p={p} f={f} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sm-legend muted small">
        {papers.length} papers × {COLS.length} facets
        <span className="sm-legend-chip shared">shared ×N</span> in ≥2 papers
        <span className="sm-legend-chip unverified">dashed</span> unverified (no verbatim match)
      </div>
    </div>
  );
}
