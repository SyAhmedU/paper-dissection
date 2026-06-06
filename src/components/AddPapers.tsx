// AddPapers — the three input modes: drop one or many PDFs, paste full text,
// or fetch a DOI. Each input is run through the dissector and saved. PDF and
// pasted text give full-text-depth dissection; a DOI gives abstract-depth
// (clearly labelled), because Crossref/OpenAlex only expose the abstract.
// Bibliographic facts for a DOI come from the real record, not the AI.

import { useMemo, useRef, useState } from 'react';
import type { Dissection } from '../lib/types';
import { newId } from '../lib/store';
import { dissect } from '../lib/extract';
import { extractPdfText } from '../lib/pdf';
import { fetchDoi, normalizeDoi } from '../lib/doi';

type Mode = 'upload' | 'paste' | 'doi';
interface LogRow { name: string; status: string; state: 'work' | 'ok' | 'warn' | 'err'; }

const MAX_DOIS = 25;        // cap a batch so it finishes quickly and stays polite to the APIs
const DELAY_MS = 350;       // gap between DOI lookups
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Parse a blob into a clean, deduped DOI list. Accepts one-per-line, comma- or
// whitespace-separated; bare DOIs or doi.org URLs; drops non-DOIs and anything
// already in the library or repeated within the paste.
function parseDois(text: string, existing: Set<string>): { dois: string[]; dropped: number; dupes: number } {
  const raw = text.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const dois: string[] = [];
  let dropped = 0, dupes = 0;
  for (const tok of raw) {
    const d = normalizeDoi(tok);
    if (!d) { dropped++; continue; }
    const key = d.toLowerCase();
    if (seen.has(key) || existing.has(key)) { dupes++; continue; }
    seen.add(key);
    dois.push(d);
  }
  return { dois, dropped, dupes };
}

async function build(opts: {
  text: string;
  source: Dissection['source'];
  depth: Dissection['depth'];
  meta?: { title?: string; authors?: string[]; year?: number; journal?: string; doi?: string };
  titleGuess?: string;
}): Promise<Dissection> {
  const res = await dissect({ text: opts.text, title: opts.meta?.title || opts.titleGuess, depth: opts.depth });
  return {
    id: newId(),
    title: opts.meta?.title || res.title || opts.titleGuess || 'Untitled paper',
    authors: opts.meta?.authors || res.authors,
    year: opts.meta?.year ?? res.year,
    journal: opts.meta?.journal || res.journal,
    doi: opts.meta?.doi,
    source: opts.source,
    depth: opts.depth,
    extractedBy: res.source,
    extractedAt: new Date().toISOString(),
    textLen: opts.text.length,
    facets: res.facets,
    notes: res.notes,
  };
}

export default function AddPapers({ onAdded, existing }: { onAdded: (ds: Dissection[]) => void; existing: Dissection[] }) {
  const [mode, setMode] = useState<Mode>('upload');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogRow[]>([]);
  const [paste, setPaste] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [dois, setDois] = useState('');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const existingDois = useMemo(() => {
    const s = new Set<string>();
    for (const d of existing) if (d.doi) s.add(d.doi.toLowerCase());
    return s;
  }, [existing]);
  const parsed = useMemo(() => parseDois(dois, existingDois), [dois, existingDois]);
  const capped = parsed.dois.slice(0, MAX_DOIS);
  const overflow = parsed.dois.length - capped.length;

  const pushLog = (row: LogRow) => setLog(l => [...l, row]);
  const patchLast = (patch: Partial<LogRow>) => setLog(l => l.map((r, i) => i === l.length - 1 ? { ...r, ...patch } : r));

  async function handleFiles(files: FileList | File[]) {
    const arr = [...files].filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!arr.length) { pushLog({ name: '—', status: 'No PDF files found in the drop.', state: 'err' }); return; }
    setBusy(true);
    const added: Dissection[] = [];
    for (const f of arr) {
      pushLog({ name: f.name, status: 'reading PDF…', state: 'work' });
      try {
        const { text, pages, titleGuess } = await extractPdfText(f, (p, t) => patchLast({ status: `reading PDF… page ${p}/${t}` }));
        if (text.trim().length < 200) {
          patchLast({ status: `only ${text.trim().length} chars of text — likely a scanned/image PDF (no OCR). Skipped.`, state: 'warn' });
          continue;
        }
        patchLast({ status: `dissecting ${pages} pages…` });
        const d = await build({ text, source: 'pdf', depth: 'full-text', titleGuess });
        added.push(d);
        patchLast({ status: `dissected → ${count(d)} items (${d.extractedBy})`, state: 'ok' });
      } catch (e) {
        patchLast({ status: `failed: ${msg(e)}`, state: 'err' });
      }
    }
    if (added.length) onAdded(added);
    setBusy(false);
  }

  async function handlePaste() {
    const text = paste.trim();
    if (text.length < 60) { pushLog({ name: 'pasted text', status: 'Paste more text (the full paper, or at least a full abstract).', state: 'err' }); return; }
    setBusy(true);
    pushLog({ name: pasteTitle || 'pasted text', status: 'dissecting…', state: 'work' });
    try {
      // Treat a short paste as abstract-depth, a long one as full text.
      const depth = text.length < 2500 ? 'abstract' : 'full-text';
      const d = await build({ text, source: 'text', depth, meta: { title: pasteTitle || undefined } });
      onAdded([d]);
      patchLast({ status: `dissected → ${count(d)} items (${d.extractedBy}, ${depth})`, state: 'ok' });
      setPaste(''); setPasteTitle('');
    } catch (e) { patchLast({ status: `failed: ${msg(e)}`, state: 'err' }); }
    setBusy(false);
  }

  async function handleDois() {
    if (!capped.length) {
      pushLog({ name: 'DOIs', status: parsed.dropped ? 'No valid DOIs found in that input.' : 'Enter at least one DOI.', state: 'err' });
      return;
    }
    setBusy(true);
    const added: Dissection[] = [];
    for (let i = 0; i < capped.length; i++) {
      const input = capped[i];
      pushLog({ name: input, status: `(${i + 1}/${capped.length}) fetching metadata…`, state: 'work' });
      try {
        const r = await fetchDoi(input);
        if (!r.hasAbstract || !r.abstract) {
          patchLast({ status: 'no abstract from Crossref/OpenAlex — paste the text instead.', state: 'warn' });
        } else {
          patchLast({ status: 'dissecting abstract…' });
          const d = await build({
            text: r.abstract, source: 'doi', depth: 'abstract',
            meta: { title: r.title, authors: r.authors, year: r.year, journal: r.journal, doi: r.doi },
          });
          added.push(d);
          patchLast({ status: `dissected (abstract-depth) → ${count(d)} items (${d.extractedBy})`, state: 'ok' });
        }
      } catch (e) { patchLast({ status: `failed: ${msg(e)}`, state: 'err' }); }
      if (i < capped.length - 1) await sleep(DELAY_MS);
    }
    if (added.length) { setDois(''); onAdded(added); }
    setBusy(false);
  }

  return (
    <div className="add-wrap">
      <div className="seg" role="tablist" aria-label="Input mode">
        <button className={mode === 'upload' ? 'on' : ''} onClick={() => setMode('upload')}>📄 Upload PDF(s)</button>
        <button className={mode === 'paste' ? 'on' : ''} onClick={() => setMode('paste')}>✎ Paste text</button>
        <button className={mode === 'doi' ? 'on' : ''} onClick={() => setMode('doi')}>🔗 DOIs</button>
      </div>

      {mode === 'upload' && (
        <div
          className={`dropzone ${drag ? 'drag' : ''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); if (!busy) handleFiles(e.dataTransfer.files); }}
          onClick={() => !busy && fileRef.current?.click()}
          role="button" tabIndex={0}
        >
          <input ref={fileRef} type="file" accept="application/pdf" multiple hidden
            onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }} />
          <div className="dz-icon">📄</div>
          <div className="dz-main">Drop PDF papers here, or click to choose</div>
          <div className="dz-sub muted small">One or many. Parsed in your browser (no upload of the file itself). Full-text dissection. Scanned/image-only PDFs can't be read (no OCR).</div>
        </div>
      )}

      {mode === 'paste' && (
        <div className="add-field">
          <label className="label" htmlFor="pt">Title (optional)</label>
          <input id="pt" className="input" placeholder="Paper title" value={pasteTitle} onChange={e => setPasteTitle(e.target.value)} />
          <label className="label" htmlFor="pb" style={{ marginTop: 12 }}>Paper text</label>
          <textarea id="pb" className="textarea" rows={12} placeholder="Paste the full paper text (best), or at least the full abstract. Everything is dissected only from what you paste — nothing is invented." value={paste} onChange={e => setPaste(e.target.value)} />
          <button className="btn primary" style={{ marginTop: 12 }} disabled={busy} onClick={handlePaste}>{busy ? 'Dissecting…' : 'Dissect'}</button>
        </div>
      )}

      {mode === 'doi' && (
        <div className="add-field">
          <label className="label" htmlFor="dois">DOI(s) — one per line (or comma / space separated), up to {MAX_DOIS} per run</label>
          <textarea id="dois" className="textarea" rows={7}
            placeholder={'10.1037/0021-9010.92.5.1206\n10.1002/job.515\nhttps://doi.org/10.1111/j.1744-6570.2010.01203.x'}
            value={dois} onChange={e => setDois(e.target.value)} disabled={busy} />
          {dois.trim() && (
            <div className="muted small" style={{ marginTop: 6 }}>
              {capped.length} valid DOI{capped.length === 1 ? '' : 's'} ready
              {parsed.dupes > 0 && ` · ${parsed.dupes} skipped (duplicate / already in library)`}
              {parsed.dropped > 0 && ` · ${parsed.dropped} unrecognised`}
              {overflow > 0 && ` · ${overflow} over the ${MAX_DOIS} cap (will be dropped)`}
            </div>
          )}
          <button className="btn primary" style={{ marginTop: 12 }} disabled={busy || !capped.length} onClick={handleDois}>
            {busy ? 'Working…' : `Fetch & dissect${capped.length ? ' ' + capped.length : ''}`}
          </button>
          <div className="muted small" style={{ marginTop: 8 }}>
            Each DOI gives the title, authors, year and <em>abstract</em> from the real Crossref/OpenAlex record — so this is an
            <strong> abstract-depth</strong> dissection. For full-text depth, upload the PDF or paste the paper. DOIs are processed
            sequentially to stay polite to the APIs.
          </div>
        </div>
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
function msg(e: unknown): string { return e instanceof Error ? e.message : String(e); }
