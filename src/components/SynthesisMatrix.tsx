// SynthesisMatrix — the classic systematic-literature-review coding grid:
// papers as rows, facets as columns, each cell listing the items that paper
// used for that facet. Lets you scan "what did each paper use" side by side.
// Click a paper title to open its full anatomy card.

import type { Dissection } from '../lib/types';
import { FACETS, facetItemLink } from '../lib/types';

const COLS = FACETS.filter(f => f.inMatrix);

export default function SynthesisMatrix({ dissections, onOpen }: { dissections: Dissection[]; onOpen: (id: string) => void }) {
  if (!dissections.length) {
    return <div className="empty">Dissect a few papers to build the synthesis matrix — papers as rows, facets as columns.</div>;
  }
  const sorted = [...dissections].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  return (
    <div>
      <p className="muted" style={{ maxWidth: 760, marginTop: 0 }}>
        Each paper's parts side by side — a coding matrix you'd otherwise build by hand for a literature review.
        Cells link out to the suite where relevant (theory → TheoryScope, measures → ScaleScope, analysis → ToolsScope).
      </p>
      <div className="pdw-scroll">
        <table className="sm-table">
          <thead>
            <tr>
              <th className="sm-rowhead-h">Paper</th>
              {COLS.map(f => (
                <th key={f.key} title={f.blurb}><span className="sm-col-icon">{f.icon}</span> {f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(d => (
              <tr key={d.id}>
                <th className="sm-rowhead" scope="row">
                  <button className="sm-paper" onClick={() => onOpen(d.id)} title="Open dissection">
                    <span className="sm-paper-title">{d.title || 'Untitled'}</span>
                    <span className="sm-paper-meta">
                      {d.authors?.[0]?.split(',')[0] ?? '—'}{d.year ? ` · ${d.year}` : ''}
                    </span>
                  </button>
                </th>
                {COLS.map(f => {
                  const items = d.facets[f.key] ?? [];
                  return (
                    <td key={f.key}>
                      {items.length === 0
                        ? <span className="sm-empty">—</span>
                        : <div className="sm-chips">
                            {items.map((it, i) => {
                              const link = facetItemLink(f.key, it);
                              const cls = `sm-chip ${it.verified ? '' : 'unverified'}`;
                              return link
                                ? <a key={i} className={cls} href={link} target="_blank" rel="noopener noreferrer" title={it.detail || it.text} style={{ ['--facet' as string]: f.color }}>{it.text}</a>
                                : <span key={i} className={cls} title={it.detail || (it.verified ? '' : 'unverified — not found verbatim in source')} style={{ ['--facet' as string]: f.color }}>{it.text}</span>;
                            })}
                          </div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>
        {sorted.length} papers × {COLS.length} facets · dashed chips are unverified (no verbatim match in source)
      </div>
    </div>
  );
}
