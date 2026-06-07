// AddJournal — pick a journal, see its real articles, dissect the ones you want.
// Journal suggestions and the article list both come straight from OpenAlex —
// every row is a real indexed work (no fabrication). Articles are dissected at
// abstract-depth (that's all OpenAlex exposes), clearly badged; ones without an
// abstract can't be dissected unattended and are flagged.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dissection } from '../lib/types';
import { buildDissection } from '../lib/build';
import { suggestJournals, fetchJournalArticles, type JournalOption, type JournalArticle, type JournalSort } from '../lib/journal';

interface LogRow { name: string; status: string; state: 'work' | 'ok' | 'warn' | 'err'; }
const MAX_SELECT = 25;
const DELAY_MS = 350;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export default function AddJournal({ onAdded, existing }: { onAdded: (ds: Dissection[]) => void; existing: Dissection[] }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<JournalOption[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [journal, setJournal] = useState<JournalOption | null>(null);
  const [sort, setSort] = useState<JournalSort>('date');
  const [perPage, setPerPage] = useState(25);
  const [articles, setArticles] = useState<JournalArticle[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const acRef = useRef<number | null>(null);

  const existingDois = useMemo(() => {
    const s = new Set<string>();
    for (const d of existing) if (d.doi) s.add(d.doi.toLowerCase());
    return s;
  }, [existing]);

  // Debounced journal autocomplete.
  useEffect(() => {
    if (journal && query === journal.name) return; // don't re-suggest right after a pick
    if (query.trim().length < 2) { setSuggestions([]); return; }
    if (acRef.current) window.clearTimeout(acRef.current);
    acRef.current = window.setTimeout(async () => {
      const res = await suggestJournals(query);
      setSuggestions(res); setShowSuggest(true);
    }, 250);
    return () => { if (acRef.current) window.clearTimeout(acRef.current); };
  }, [query, journal]);

  const alreadyHave = (a: JournalArticle) => !!a.doi && existingDois.has(a.doi.toLowerCase());

  async function loadArticles(j: JournalOption, s: JournalSort, n: number) {
    setFetching(true); setArticles([]); setSelected(new Set()); setLog([]);
    try {
      const { articles: arts, total: t } = await fetchJournalArticles(j.id, { sort: s, perPage: n });
      setArticles(arts); setTotal(t);
      // Pre-select dissectable ones (have an abstract, not already in library).
      const pre = new Set<string>();
      for (const a of arts) if (a.abstract && !alreadyHave(a)) pre.add(a.oaId);
      setSelected(pre);
    } catch {
      setLog([{ name: j.name, status: 'could not fetch articles from OpenAlex — try again.', state: 'err' }]);
    }
    setFetching(false);
  }

  function pick(j: JournalOption) {
    setJournal(j); setQuery(j.name); setShowSuggest(false); setSuggestions([]);
    loadArticles(j, sort, perPage);
  }

  function toggle(oaId: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(oaId)) n.delete(oaId); else n.add(oaId); return n; });
  }

  const selectable = articles.filter(a => a.abstract && !alreadyHave(a));
  const selectedCount = articles.filter(a => selected.has(a.oaId) && a.abstract).length;
  const capped = Math.min(selectedCount, MAX_SELECT);

  function selectAll() { setSelected(new Set(selectable.slice(0, MAX_SELECT).map(a => a.oaId))); }
  function selectNone() { setSelected(new Set()); }

  async function dissectSelected() {
    const pickList = articles.filter(a => selected.has(a.oaId) && a.abstract).slice(0, MAX_SELECT);
    if (!pickList.length) return;
    setBusy(true); setLog([]);
    const added: Dissection[] = [];
    for (let i = 0; i < pickList.length; i++) {
      const a = pickList[i];
      setLog(l => [...l, { name: a.title.slice(0, 60), status: `(${i + 1}/${pickList.length}) dissecting abstract…`, state: 'work' }]);
      try {
        const d = await buildDissection({
          text: a.abstract!, source: 'journal', depth: 'abstract',
          meta: { title: a.title, authors: a.authors, year: a.year, journal: journal?.name, doi: a.doi },
        });
        added.push(d);
        setLog(l => l.map((r, idx) => idx === l.length - 1 ? { ...r, status: `dissected → ${count(d)} items (${d.extractedBy})`, state: 'ok' } : r));
      } catch (e) {
        setLog(l => l.map((r, idx) => idx === l.length - 1 ? { ...r, status: `failed: ${e instanceof Error ? e.message : String(e)}`, state: 'err' } : r));
      }
      if (i < pickList.length - 1) await sleep(DELAY_MS);
    }
    if (added.length) onAdded(added);
    setBusy(false);
  }

  return (
    <div className="add-field">
      <label className="label" htmlFor="jq">Journal</label>
      <div className="jr-search">
        <input id="jq" className="input" autoComplete="off"
          placeholder="Search a journal, e.g. Journal of Applied Psychology" value={query}
          onChange={e => { setQuery(e.target.value); setJournal(null); }}
          onFocus={() => suggestions.length && setShowSuggest(true)} />
        {showSuggest && suggestions.length > 0 && (
          <ul className="jr-suggest">
            {suggestions.map(s => (
              <li key={s.id}><button className="jr-suggest-item" onClick={() => pick(s)}>
                <span className="jr-suggest-name">{s.name}</span>
                {s.hint && <span className="jr-suggest-hint">{s.hint}</span>}
              </button></li>
            ))}
          </ul>
        )}
      </div>

      {journal && (
        <div className="jr-controls">
          <span className="muted small">Showing {articles.length} of {total.toLocaleString()} articles in <strong>{journal.name}</strong></span>
          <span style={{ flex: 1 }} />
          <label className="jr-ctl">Sort
            <select className="jr-select" value={sort} onChange={e => { const s = e.target.value as JournalSort; setSort(s); loadArticles(journal, s, perPage); }}>
              <option value="date">Newest</option>
              <option value="citations">Most cited</option>
            </select>
          </label>
          <label className="jr-ctl">Show
            <select className="jr-select" value={perPage} onChange={e => { const n = Number(e.target.value); setPerPage(n); loadArticles(journal, sort, n); }}>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>
      )}

      {fetching && <div className="muted small" style={{ marginTop: 10 }}>Fetching real articles from OpenAlex…</div>}

      {articles.length > 0 && !fetching && (
        <>
          <div className="jr-bulkbar">
            <button className="btn small ghost" onClick={selectAll} disabled={busy}>Select dissectable ({Math.min(selectable.length, MAX_SELECT)})</button>
            <button className="btn small ghost" onClick={selectNone} disabled={busy}>Clear</button>
            <span style={{ flex: 1 }} />
            <button className="btn primary" onClick={dissectSelected} disabled={busy || capped === 0}>
              {busy ? 'Dissecting…' : `Dissect selected${capped ? ' ' + capped : ''}`}
            </button>
          </div>
          <ul className="jr-list">
            {articles.map(a => {
              const have = alreadyHave(a);
              const can = !!a.abstract && !have;
              return (
                <li key={a.oaId} className={`jr-row ${can ? '' : 'disabled'}`}>
                  <input type="checkbox" checked={selected.has(a.oaId) && !!a.abstract} disabled={!can || busy} onChange={() => toggle(a.oaId)} aria-label={`Select ${a.title}`} />
                  <div className="jr-row-main">
                    <div className="jr-row-title">{a.title}</div>
                    <div className="jr-row-meta">
                      {a.authors[0]?.split(' ').slice(-1)[0] ?? '—'}{a.authors.length > 1 ? ' et al.' : ''}
                      {a.year ? ` · ${a.year}` : ''} · {a.citedBy.toLocaleString()} cites
                      {a.doi ? <> · <span className="mono">{a.doi}</span></> : ''}
                    </div>
                  </div>
                  {have ? <span className="jr-flag have">in library</span>
                    : a.abstract ? <span className="jr-flag ok">abstract ✓</span>
                    : <span className="jr-flag none">no abstract</span>}
                </li>
              );
            })}
          </ul>
          <div className="muted small">
            Dissected at <strong>abstract-depth</strong> from the real OpenAlex record. Articles with no abstract can't be dissected here — open them by DOI/PDF. Up to {MAX_SELECT} per run.
          </div>
        </>
      )}

      {log.length > 0 && (
        <ul className="add-log">
          {log.map((r, i) => (
            <li key={i} className={`add-log-row ${r.state}`}>
              <span className="alr-name">{r.name}</span>
              <span className="alr-status">{r.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function count(d: Dissection): number {
  return Object.values(d.facets).reduce((n, arr) => n + arr.length, 0);
}
