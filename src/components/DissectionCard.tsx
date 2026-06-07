// DissectionCard — the per-paper anatomy. Header (title/authors/year/journal +
// source & depth badges), extraction notes, then one block per facet with its
// extracted items. Each item shows optional detail, a suite deep-link where the
// facet maps to one (theory→TheoryScope, measures→ScaleScope, analysis→ToolsScope),
// and a grounding state: the verbatim evidence snippet, or an "unverified" flag
// when the snippet wasn't found in the source.

import { useState } from 'react';
import type { Dissection, FacetKey, FacetItem } from '../lib/types';
import { FACETS, facetItemLink } from '../lib/types';
import { natureOf, NATURE_BY_KEY, estimateTimeFlow, weeksLabel } from '../lib/nature';

const TF_COLORS = ['#FF9656', '#F14575', '#9270F4', '#22d3ee', '#1b8a5a', '#c97a1a'];

function TimeFlowBar({ d }: { d: Dissection }) {
  const tf = estimateTimeFlow(d);
  return (
    <section className="dc-timeflow">
      <div className="dc-tf-head">
        <span className="dc-tf-title">⏳ Probable time flow</span>
        <span className="dc-tf-total">{weeksLabel(tf.totalWeeks)}{tf.longitudinal ? ' · longitudinal' : ''}</span>
      </div>
      <div className="dc-tf-bar">
        {tf.phases.map((p, i) => (
          <div key={i} className="dc-tf-seg" style={{ flexGrow: p.weeks, background: TF_COLORS[i % TF_COLORS.length] }} title={`${p.phase} · ${p.weeks} weeks`} />
        ))}
      </div>
      <div className="dc-tf-legend">
        {tf.phases.map((p, i) => (
          <span key={i} className="dc-tf-leg"><span className="dc-tf-dot" style={{ background: TF_COLORS[i % TF_COLORS.length] }} />{p.phase} <b>{p.weeks}w</b></span>
        ))}
      </div>
      <div className="dc-tf-note">Estimated planning timeline for a {NATURE_BY_KEY[tf.nature].label.toLowerCase()} study — heuristic, not extracted from the paper.</div>
    </section>
  );
}

function Badges({ d }: { d: Dissection }) {
  const srcLabel = d.extractedBy === 'ai' ? 'AI-EXTRACTED' : 'HEURISTIC';
  const srcTitle = d.extractedBy === 'ai'
    ? 'Extracted by AI from the source text — verify against the paper'
    : 'Offline heuristic — limited; verify and edit';
  const depthLabel = d.depth === 'full-text' ? 'FULL TEXT' : 'ABSTRACT ONLY';
  const inputLabel = d.source === 'pdf' ? 'PDF' : d.source === 'doi' ? 'DOI' : d.source === 'journal' ? 'JOURNAL' : 'TEXT';
  const nm = NATURE_BY_KEY[natureOf(d)];
  return (
    <span className="dc-badges">
      <span className="dc-badge nature" style={{ ['--nat' as string]: nm.color }} title="Nature of study (derived from the methods)">{nm.icon} {nm.label}</span>
      <span className="dc-badge input" title="Input type">{inputLabel}</span>
      <span className={`dc-badge depth ${d.depth}`} title="How much of the paper was dissected">{depthLabel}</span>
      <span className={`dc-badge src ${d.extractedBy}`} title={srcTitle}>{srcLabel}</span>
    </span>
  );
}

function Item({ facet, item }: { facet: FacetKey; item: FacetItem }) {
  const [showEv, setShowEv] = useState(false);
  const link = facetItemLink(facet, item);
  return (
    <li className={`dc-item ${item.verified ? '' : 'unverified'}`}>
      <div className="dc-item-row">
        <span className="dc-item-text">{item.text}</span>
        {item.detail && <span className="dc-item-detail">{item.detail}</span>}
        {link && (
          <a className="dc-item-link" href={link} target="_blank" rel="noopener noreferrer"
            title="Look this up in the suite">↗</a>
        )}
        {item.evidence
          ? <button className="dc-ev-toggle" onClick={() => setShowEv(v => !v)}
              title={item.verified ? 'Show the verbatim snippet from the paper' : 'Snippet not found in the source text'}>
              {item.verified ? '“ ”' : '⚠'}
            </button>
          : <span className="dc-ev-toggle muted" title="No supporting snippet provided">·</span>}
      </div>
      {showEv && item.evidence && (
        <div className={`dc-evidence ${item.verified ? '' : 'unverified'}`}>
          {!item.verified && <span className="dc-ev-warn">not found verbatim in source — </span>}
          “{item.evidence}”
        </div>
      )}
    </li>
  );
}

export default function DissectionCard({ d, onDelete }: { d: Dissection; onDelete?: () => void }) {
  const facetsWith = FACETS.filter(f => (d.facets[f.key]?.length ?? 0) > 0);
  const totalItems = FACETS.reduce((n, f) => n + (d.facets[f.key]?.length ?? 0), 0);

  return (
    <article className="dc">
      <header className="dc-head">
        <div className="dc-head-body">
          <h2 className="dc-title">{d.title || 'Untitled paper'}</h2>
          <div className="dc-meta">
            {d.authors?.length ? <span>{d.authors.slice(0, 3).join(', ')}{d.authors.length > 3 ? ' et al.' : ''}</span> : null}
            {d.year ? <span> · <strong>{d.year}</strong></span> : null}
            {d.journal ? <span> · {d.journal}</span> : null}
          </div>
          <Badges d={d} />
        </div>
        {onDelete && (
          <button className="btn small ghost" onClick={onDelete} title="Remove" aria-label="Remove">✕</button>
        )}
      </header>

      {d.notes?.length ? (
        <ul className="dc-notes">
          {d.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      ) : null}

      <TimeFlowBar d={d} />

      <div className="dc-facetcount mono">{totalItems} items across {facetsWith.length} facets · {d.textLen.toLocaleString()} chars dissected</div>

      <div className="dc-facets">
        {facetsWith.map(f => (
          <section className="dc-facet" key={f.key} style={{ ['--facet' as string]: f.color }}>
            <div className="dc-facet-head">
              <span className="dc-facet-icon" aria-hidden="true">{f.icon}</span>
              <span className="dc-facet-label">{f.label}</span>
              <span className="dc-facet-count">{d.facets[f.key].length}</span>
            </div>
            <ul className="dc-items">
              {d.facets[f.key].map((it, i) => <Item key={i} facet={f.key} item={it} />)}
            </ul>
          </section>
        ))}
        {facetsWith.length === 0 && (
          <div className="muted small">No facets could be extracted from the supplied text.</div>
        )}
      </div>
    </article>
  );
}
